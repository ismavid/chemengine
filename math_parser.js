/**
 * math_parser.js — Lightweight Math Expression Parser
 * Parses an algebraic string into a fast evaluable JavaScript function f(x).
 * Supports: +, -, *, /, ^, ( ), sin, cos, tan, asin, acos, atan, exp, ln, log, log10, sqrt, abs, e, pi
 */
'use strict';

const MathParser = (() => {

    // Shunting-yard + RPN evaluator for speed and safety (no eval/new Function)

    const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
    const RIGHT_ASSOC = { '^': true };
    const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'ln', 'log', 'log10', 'sqrt', 'abs']);
    const CONSTANTS = { 'pi': Math.PI, 'e': Math.E };

    function tokenize(expr) {
        const tokens = [];
        let i = 0;

        // Remove spaces
        expr = expr.replace(/\s+/g, '').toLowerCase();

        // Handle implicit multiplication nicely: 2x -> 2*x, 2(x) -> 2*(x), (x)(x) -> (x)*(x)
        // Also fix multiple signs: --x -> x
        expr = expr.replace(/(\d)([a-z\(])/g, '$1*$2')
            .replace(/([x\)])(\d)/g, '$1*$2')
            .replace(/\)([a-z\(])/g, ')*$1')
            .replace(/([a-z])\(/g, (match, p1) => FUNCTIONS.has(p1) ? match : p1 + '*('); // e.g. x(x+1) -> x*(x+1), but sin(x) -> sin(x)

        while (i < expr.length) {
            let c = expr[i];

            if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^' || c === '(' || c === ')') {
                // Check if "-" or "+" is unary
                if ((c === '-' || c === '+') && (i === 0 || '+(/*^-'.includes(expr[i - 1]))) {
                    tokens.push({ type: 'unary', value: c === '-' ? 'neg' : 'pos' });
                } else {
                    tokens.push({ type: 'op', value: c });
                }
                i++;
            } else if (/[a-z]/.test(c)) {
                let name = '';
                while (i < expr.length && /[a-z0-9]/.test(expr[i])) {
                    name += expr[i++];
                }
                if (FUNCTIONS.has(name)) tokens.push({ type: 'func', value: name });
                else if (CONSTANTS[name] !== undefined) tokens.push({ type: 'num', value: CONSTANTS[name] });
                else if (name === 'x') tokens.push({ type: 'var', value: 'x' });
                else throw new Error(`Unknown function or variable: ${name}`);
            } else if (/[0-9\.]/.test(c)) {
                let num = '';
                while (i < expr.length && /[0-9\.]/.test(expr[i])) {
                    num += expr[i++];
                }
                tokens.push({ type: 'num', value: parseFloat(num) });
            } else {
                throw new Error(`Unexpected character: ${c}`);
            }
        }
        return tokens;
    }

    function toRPN(tokens) {
        const out = [];
        const opStack = [];

        for (let t of tokens) {
            if (t.type === 'num' || t.type === 'var') {
                out.push(t);
            } else if (t.type === 'func' || t.type === 'unary') {
                opStack.push(t);
            } else if (t.type === 'op' && t.value === '(') {
                opStack.push(t);
            } else if (t.type === 'op' && t.value === ')') {
                while (opStack.length && opStack[opStack.length - 1].value !== '(') {
                    out.push(opStack.pop());
                }
                if (!opStack.length) throw new Error("Mismatched parentheses");
                opStack.pop(); // discard '('
                if (opStack.length && opStack[opStack.length - 1].type === 'func') {
                    out.push(opStack.pop());
                }
            } else if (t.type === 'op') {
                while (opStack.length) {
                    let top = opStack[opStack.length - 1];
                    if (top.type === 'unary') {
                        out.push(opStack.pop());
                        continue;
                    }
                    if (top.type !== 'op' || top.value === '(') break;

                    let precTop = PRECEDENCE[top.value];
                    let precCurr = PRECEDENCE[t.value];

                    if (precTop > precCurr || (precTop === precCurr && !RIGHT_ASSOC[t.value])) {
                        out.push(opStack.pop());
                    } else {
                        break;
                    }
                }
                opStack.push(t);
            }
        }
        while (opStack.length) {
            let top = opStack.pop();
            if (top.value === '(' || top.value === ')') throw new Error("Mismatched parentheses");
            out.push(top);
        }
        return out;
    }

    /**
     * Compiles expression string into a callable function (x) => result.
     * Fast execution bypassing eval.
     */
    function compile(exprStr) {
        if (!exprStr.trim()) throw new Error("Empty expression");

        let lhs = exprStr, rhs = "0";
        if (exprStr.includes('=')) {
            const parts = exprStr.split('=');
            if (parts.length > 2) throw new Error("Multiple '=' signs found");
            lhs = parts[0];
            rhs = parts[1];
        }

        // Solve f(x) = LHS - RHS
        const fullExpr = `(${lhs}) - (${rhs})`;
        const tokens = tokenize(fullExpr);
        const rpn = toRPN(tokens);

        return function evaluate(xValue) {
            const stack = [];
            for (let i = 0; i < rpn.length; i++) {
                let t = rpn[i];
                if (t.type === 'num') stack.push(t.value);
                else if (t.type === 'var') stack.push(xValue);
                else if (t.type === 'unary') {
                    let a = stack.pop();
                    stack.push(t.value === 'neg' ? -a : a);
                }
                else if (t.type === 'op') {
                    let b = stack.pop();
                    let a = stack.pop();
                    if (t.value === '+') stack.push(a + b);
                    else if (t.value === '-') stack.push(a - b);
                    else if (t.value === '*') stack.push(a * b);
                    else if (t.value === '/') stack.push(a / b);
                    else if (t.value === '^') stack.push(Math.pow(a, b));
                }
                else if (t.type === 'func') {
                    let a = stack.pop();
                    let v;
                    switch (t.value) {
                        case 'sin': v = Math.sin(a); break;
                        case 'cos': v = Math.cos(a); break;
                        case 'tan': v = Math.tan(a); break;
                        case 'asin': v = Math.asin(a); break;
                        case 'acos': v = Math.acos(a); break;
                        case 'atan': v = Math.atan(a); break;
                        case 'exp': v = Math.exp(a); break;
                        case 'ln':
                        case 'log': v = Math.log(a); break;
                        case 'log10': v = Math.log10(a); break;
                        case 'sqrt': v = Math.sqrt(a); break;
                        case 'abs': v = Math.abs(a); break;
                    }
                    stack.push(v);
                }
            }
            if (stack.length !== 1) throw new Error("Invalid expression structure");
            return stack[0];
        };
    }

    return { compile, tokenize };
})();

window.MathParser = MathParser;
