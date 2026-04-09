/**
 * math_solver.js — Numerical Root Finding and Definite Integration
 * Lightweight numerical methods for f(x) = 0 and ∫f(x)dx.
 */
'use strict';

const MathSolver = (() => {

    const EPSILON = 1e-8;
    const MAX_ITER = 1000;

    /**
     * Secant method to find root of f(x) = 0
     * @param {function} f Function to solve
     * @param {number} guess Initial guess
     */
    function findRoot(f, guess) {
        let x0 = guess;
        let x1 = guess + 0.1; // Small offset for secant

        let f0 = f(x0);
        let f1 = f(x1);

        if (Math.abs(f0) < EPSILON) return x0;
        if (Math.abs(f1) < EPSILON) return x1;

        for (let i = 0; i < MAX_ITER; i++) {
            if (Math.abs(f1 - f0) < 1e-14) {
                // Derivative approaching zero. Try random perturb.
                x1 += (Math.random() - 0.5) * 0.1;
                f1 = f(x1);
                continue;
            }

            let x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
            let f2 = f(x2);

            if (Math.abs(f2) < EPSILON) return x2;

            x0 = x1;
            f0 = f1;
            x1 = x2;
            f1 = f2;
        }

        throw new Error("Equation parser: Did not converge to a root. Try a different initial guess.");
    }

    /**
     * Sweeps a range around the guess to find multiple roots using sign changes and secant method.
     */
    function findAllRoots(f, guess, range = 50, steps = 2000) {
        let roots = [];

        // Always try finding a root starting exactly at the guess
        try {
            roots.push(findRoot(f, guess));
        } catch (e) { }

        // Sweep range to find sign changes
        let xStart = guess - range;
        let xEnd = guess + range;
        let dx = (xEnd - xStart) / steps;

        let prevX = xStart;
        let prevY = f(prevX);

        for (let i = 1; i <= steps; i++) {
            let currX = xStart + i * dx;
            let currY = f(currX);

            if (prevY * currY <= 0) {
                // Sign change means a root exists between prevX and currX
                try {
                    let root = findRoot(f, (prevX + currX) / 2);
                    roots.push(root);
                } catch (e) { }
            }
            prevX = currX;
            prevY = currY;
        }

        // Filter unique roots (within a small tolerance)
        let uniqueRoots = [];
        for (let r of roots) {
            let isDup = false;
            for (let ur of uniqueRoots) {
                if (Math.abs(r - ur) < 1e-5) {
                    isDup = true;
                    break;
                }
            }
            if (!isDup) uniqueRoots.push(r);
        }

        // Sort by how close they are to the initial guess
        uniqueRoots.sort((a, b) => Math.abs(a - guess) - Math.abs(b - guess));

        if (uniqueRoots.length === 0) {
            throw new Error("Did not converge to a root. Try a different initial guess or a valid equation.");
        }

        return uniqueRoots;
    }

    /**
     * Simpson's 3/8 Rule for Numerical Integration
     * Integrates f(x) from a to b using n intervals.
     */
    function integrate(f, a, b, n = 1000) {
        // Ensure n is a multiple of 3
        if (n % 3 !== 0) n += 3 - (n % 3);

        let h = (b - a) / n;
        let sum = f(a) + f(b);

        for (let i = 1; i < n; i++) {
            let x = a + i * h;
            if (i % 3 === 0) {
                sum += 2 * f(x);
            } else {
                sum += 3 * f(x);
            }
        }

        return (3 * h / 8) * sum;
    }

    /**
     * Find an unknown integration limit (Upper or Lower) given the Area
     */
    function solveLimit(f, knownLimitStr, isUpperUnknown, targetAreaStr) {
        let knownLimit = parseFloat(knownLimitStr);
        let targetArea = parseFloat(targetAreaStr);

        if (isNaN(knownLimit)) throw new Error("Known limit is invalid.");
        if (isNaN(targetArea)) throw new Error("Area is invalid.");

        // Root finding function: g(x) = Area(x) - targetArea = 0
        const g = (x) => {
            let a = isUpperUnknown ? knownLimit : x;
            let b = isUpperUnknown ? x : knownLimit;
            // Adaptive n based on width: min 30, max 3000
            let width = Math.abs(b - a);
            let n = Math.max(30, Math.min(3000, Math.ceil(width * 50)));
            return integrate(f, a, b, n) - targetArea;
        };

        // Initial guess based on simple rectangle approximation assuming f(knownLimit) != 0
        let valAtKnown = f(knownLimit);
        let rectHeight = (Math.abs(valAtKnown) > 1e-4) ? valAtKnown : 1.0;

        let guessOffset = targetArea / rectHeight;
        // Limit wild initial guesses
        if (Math.abs(guessOffset) > 1000) guessOffset = Math.sign(guessOffset) * 1000;

        let guess = isUpperUnknown ? (knownLimit + guessOffset) : (knownLimit - guessOffset);

        try {
            return findRoot(g, guess);
        } catch (err) {
            throw new Error("Integration limit did not converge. The function might not reach the target area.");
        }
    }

    return { findRoot, findAllRoots, integrate, solveLimit };
})();

window.MathSolver = MathSolver;
