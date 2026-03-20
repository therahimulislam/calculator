// UI Elements
const currentDisplay = document.getElementById('current-display');
const expressionDisplay = document.getElementById('expression-display');
const resultPreview = document.getElementById('result-preview');
const themeBtn = document.getElementById('theme-btn');
const themeIcon = document.getElementById('theme-icon');
const sciBtn = document.getElementById('sci-btn');
const sciPanel = document.getElementById('scientific-panel');
const calculator = document.querySelector('.calculator');
const historyBtn = document.getElementById('history-btn');
const historyPanel = document.getElementById('history-panel');
const closeHistoryBtn = document.getElementById('close-history-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyList = document.getElementById('history-list');
const copyBtn = document.getElementById('copy-btn');
const toast = document.getElementById('toast');

// State
let displayValue = '0';
let currentExpression = '';
let isEvaluated = false;
let history = JSON.parse(localStorage.getItem('calc-history')) || [];

// Initialization
function init() {
    renderHistory();
    attachEventListeners();
    
    // Set theme based on system preference if initial
    if (!localStorage.getItem('calc-theme')) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        updateThemeIcon(prefersDark);
    } else {
        const theme = localStorage.getItem('calc-theme');
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeIcon(theme === 'dark');
    }
}

// Event Listeners
function attachEventListeners() {
    // Theme toggle
    themeBtn.addEventListener('click', () => {
        const root = document.documentElement;
        const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('calc-theme', newTheme);
        updateThemeIcon(newTheme === 'dark');
    });

    // Scientific mode toggle
    sciBtn.addEventListener('click', () => {
        const isSci = sciPanel.classList.toggle('hidden');
        sciBtn.classList.toggle('active');
        calculator.classList.toggle('sci-mode');
    });

    // History Toggle
    historyBtn.addEventListener('click', openHistory);
    closeHistoryBtn.addEventListener('click', closeHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);

    // Copy Result
    copyBtn.addEventListener('click', () => {
        if (displayValue && displayValue !== 'Error') {
            navigator.clipboard.writeText(displayValue).then(() => {
                showToast();
            });
        }
    });

    // Keypad Logic
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            const value = btn.getAttribute('data-value') || btn.innerText;
            handleInput(action, value);
            
            // Haptic Feedback for Mobile
            if (navigator.vibrate) {
                navigator.vibrate(50); // Provide a 50ms vibration
            }
            
            // Add Ripple
            createRipple(e, btn);
        });
    });

    // Keyboard support
    window.addEventListener('keydown', handleKeyboardInput);
}

// Visual updates
function updateDisplay() {
    // Scale down text if too long
    if (displayValue.length > 9) {
        let size = 3.5 - (displayValue.length - 9) * 0.15;
        if (size < 1.5) size = 1.5;
        currentDisplay.style.fontSize = `${size}rem`;
    } else {
        currentDisplay.style.fontSize = '3.5rem';
    }

    currentDisplay.innerText = displayValue;
    expressionDisplay.innerText = currentExpression;

    // Update real-time preview if valid expression
    if (currentExpression && !isEvaluated) {
        const liveRes = safeEvaluate(currentExpression);
        if (liveRes !== null && liveRes.toString() !== currentExpression) {
            resultPreview.innerText = `= ${liveRes}`;
            resultPreview.classList.add('visible');
        } else {
            resultPreview.classList.remove('visible');
        }
    } else {
        resultPreview.classList.remove('visible');
    }
}

function updateThemeIcon(isDark) {
    if (isDark) {
        themeIcon.className = 'fa-solid fa-sun'; // Next state is light
    } else {
        themeIcon.className = 'fa-solid fa-moon'; // Next state is dark
    }
}

// Logic handling
function handleInput(action, value) {
    if (displayValue === 'Error') {
        currentExpression = '';
        displayValue = '0';
        isEvaluated = false;
    }

    if (action === 'number' || (!action && value >= '0' && value <= '9')) {
        if (isEvaluated) {
            currentExpression = value;
            displayValue = value;
            isEvaluated = false;
        } else {
            if (displayValue === '0' && currentExpression === '') {
                displayValue = value;
                currentExpression = value;
            } else {
                displayValue += value;
                currentExpression += value;
            }
        }
    } else if (value === '.') {
        // Simple duplicate dot check in current segment
        const segments = displayValue.split(/[+\-×÷^%()]/);
        const currentSegment = segments[segments.length - 1];
        if (!currentSegment.includes('.')) {
            if (isEvaluated) {
                currentExpression = '0.';
                displayValue = '0.';
                isEvaluated = false;
            } else {
                displayValue += '.';
                currentExpression += '.';
            }
        }
    } else if (action === 'operator') {
        if (isEvaluated) {
            currentExpression = displayValue + value;
            isEvaluated = false;
        } else {
            // Prevent duplicate operators except for negative sign
            const lastChar = currentExpression.slice(-1);
            if (['+', '-', '×', '÷', '^', '%'].includes(lastChar) && value !== '-') {
                currentExpression = currentExpression.slice(0, -1) + value;
            } else {
                currentExpression += value;
            }
        }
        displayValue = currentExpression;
    } else if (action === 'func') {
        if (isEvaluated) {
            currentExpression = value;
            isEvaluated = false;
        } else {
            if (displayValue === '0') {
                currentExpression = value;
            } else {
                // If ending with number, multiply
                if (/\d$/.test(currentExpression)) {
                    currentExpression += '×' + value;
                } else {
                    currentExpression += value;
                }
            }
        }
        displayValue = currentExpression;
    } else if (action === 'constant') {
        if (isEvaluated) {
            currentExpression = value;
            isEvaluated = false;
        } else {
            if (displayValue === '0') {
                currentExpression = value;
            } else {
                if (/\d$/.test(currentExpression)) {
                    currentExpression += '×' + value;
                } else {
                    currentExpression += value;
                }
            }
        }
        displayValue = currentExpression;
    } else if (action === 'parentheses') {
        // Auto-detect open or close
        const openCnt = (currentExpression.match(/\(/g) || []).length;
        const closeCnt = (currentExpression.match(/\)/g) || []).length;
        if (openCnt > closeCnt && /\d|\)|!|π|e$/.test(currentExpression.slice(-1))) {
            currentExpression += ')';
        } else {
            if (displayValue === '0' || isEvaluated) {
                currentExpression = '(';
                isEvaluated = false;
            } else {
                if (/\d|\)|!|π|e$/.test(currentExpression.slice(-1))) {
                    currentExpression += '×(';
                } else {
                    currentExpression += '(';
                }
            }
        }
        displayValue = currentExpression;
    } else if (action === 'clear') {
        currentExpression = '';
        displayValue = '0';
        isEvaluated = false;
    } else if (action === 'delete') {
        if (isEvaluated) {
            currentExpression = '';
            displayValue = '0';
            isEvaluated = false;
        } else {
            currentExpression = currentExpression.slice(0, -1);
            if (currentExpression === '') {
                displayValue = '0';
            } else {
                displayValue = currentExpression;
            }
        }
    } else if (action === 'calculate') {
        if (currentExpression !== '') {
            const result = safeEvaluate(currentExpression);
            if (result !== null) {
                addToHistory(currentExpression, result.toString());
                displayValue = result.toString();
                currentExpression = displayValue;
                isEvaluated = true;
            } else {
                displayValue = 'Error';
            }
        }
    }

    updateDisplay();
}

// Math Evaluation
function safeEvaluate(expr) {
    if (!expr) return null;
    try {
        // Handle factorials first
        let prepared = expr;
        while (prepared.includes('!')) {
            prepared = prepared.replace(/(\d+(?:\.\d+)?)!/g, (match, p1) => computeFactorial(Number(p1)));
        }

        // Auto close parentheses for robust live preview
        const openCnt = (prepared.match(/\(/g) || []).length;
        const closeCnt = (prepared.match(/\)/g) || []).length;
        if (openCnt > closeCnt) {
            prepared += ')'.repeat(openCnt - closeCnt);
        }

        let jsExpr = prepared
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/%/g, '/100')
            .replace(/\^/g, '**')
            .replace(/π/g, 'Math.PI')
            .replace(/e/g, 'Math.E')
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/√\(/g, 'Math.sqrt(');

        // Security check, prevent completely arbitrary code execution
        if (/[^0-9Math.\+\-\*\/\%\(\)\*\*\s]/.test(jsExpr.replace(/Math\.[a-z0-9]+/gi, ''))) {
             throw new Error("Invalid characters");
        }

        let result = new Function("return " + jsExpr)();
        
        if (typeof result !== 'number' || Number.isNaN(result)) throw new Error("NaN");
        if (!Number.isFinite(result)) throw new Error("Infinity");
        
        // Round to 8 decimal places avoiding precision issues
        return Math.round(result * 1e8) / 1e8;
    } catch (e) {
        return null;
    }
}

function computeFactorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

// Keyboard input
function handleKeyboardInput(e) {
    // Ignore input if history is open to prevent accidental presses
    if (!historyPanel.classList.contains('hidden')) {
        if (e.key === 'Escape') closeHistory();
        return;
    }

    const key = e.key;
    if (key >= '0' && key <= '9') {
        handleInput(null, key);
    } else if (key === '.') {
        handleInput(null, '.');
    } else if (key === '+' || key === '-' || key === '%') {
        handleInput('operator', key);
    } else if (key === '*') {
        handleInput('operator', '×');
    } else if (key === '/') {
        e.preventDefault(); // prevent find in page
        handleInput('operator', '÷');
    } else if (key === '^') {
        handleInput('operator', '^');
    } else if (key === '(' || key === ')') {
        handleInput('parentheses', null);
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleInput('calculate', null);
    } else if (key === 'Backspace') {
        handleInput('delete', null);
    } else if (key === 'Escape') {
        handleInput('clear', null);
    }
}

// History Handling
function addToHistory(expr, res) {
    if (expr === res) return; // Don't add simple number equals to himself
    
    // Auto remove trailing operator if exists before saving
    if (/[+\-×÷^%]$/.test(expr)) expr = expr.slice(0, -1);

    if (history.length > 0 && history[0].expr === expr) return; // Prevent duplicate immediate
    
    history.unshift({ expr, res });
    if (history.length > 20) history.pop();
    
    localStorage.setItem('calc-history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = `<div class="empty-history"><div class="clock-icon"><i class="fa-regular fa-clock"></i></div><p>No history yet</p></div>`;
        return;
    }
    
    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<div class="expr">${item.expr} =</div><div class="res">${item.res}</div>`;
        
        // Allow clicking history item to restore it
        div.addEventListener('click', () => {
            currentExpression = item.res;
            displayValue = item.res;
            isEvaluated = true;
            updateDisplay();
            closeHistory();
        });
        
        historyList.appendChild(div);
    });
}

function openHistory() {
    historyPanel.classList.remove('hidden');
}

function closeHistory() {
    historyPanel.classList.add('hidden');
}

function clearHistory() {
    history = [];
    localStorage.removeItem('calc-history');
    renderHistory();
}

// Visual Effects
function createRipple(event, button) {
    const rect = button.getBoundingClientRect();
    
    let x, y;
    // Check if it was touched/clicked or keyboard triggered. event.clientX is 0 for keyboard.
    if (event.clientX) { 
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
    } else {
        x = rect.width / 2;
        y = rect.height / 2;
    }
    
    const circle = document.createElement('span');
    circle.classList.add('ripple');
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    
    // Calculate size
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.marginLeft = circle.style.marginTop = `${-diameter / 2}px`;
    
    button.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// Start
init();
