
const nu_str = "-1, -1, 2";
const F0_str = "74.9, 28, 0.9";
const nu = nu_str.split(',').map(n => Number(n.trim()));
const F0 = F0_str.split(',').map(n => Number(n.trim()));
console.log("nu:", nu);
console.log("F0:", F0);

let reactantIndices = [];
for (let i = 0; i < nu.length; i++) {
    if (nu[i] < 0) reactantIndices.push(i);
}
console.log("reactantIndices:", reactantIndices);
