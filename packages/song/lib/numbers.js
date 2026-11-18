// Words for powers of a thousand from one thousand (10^3) up to one nonillion (10^30)
const scales = [
    '',
    'thousand',
    'million',
    'billion',
    'trillion',
    'quadrillion',
    'quintillion',
    'sextillion',
    'septillion',
    'octillion',
    'nonillion',
    // Feel free add more scales, if you're still running the program. The
    // estimated time for centillion iterations of the song would be many orders
    // of magnitude longer than the current estimated age of the universe, which
    // is about 13.8 billion years. However, as a rough estimate for the lifetime
    // of the universe, past and future, a googol (1^100) is sometimes used, so
    // you could definitely still get a few more scales in there.
];
// Words for numbers from zero to nineteen
const unitsAndTeens = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
];
// Words for multiples of ten from twenty to ninety
const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
];
function isExactMultiple(num, divisor) {
    return num % divisor === 0n;
}
export function numberToWords(num) {
    if (num < 20n) {
        return unitsAndTeens[Number(num)];
    }
    else if (num < 100n) {
        const tensWord = tens[Math.floor(Number(num / 10n))];
        return isExactMultiple(num, 10n)
            ? tensWord
            : `${tensWord}-${unitsAndTeens[Number(num % 10n)]}`;
    }
    else if (num < 1000n) {
        const hundreds = unitsAndTeens[Math.floor(Number(num / 100n))];
        return isExactMultiple(num, 100n)
            ? `${hundreds} hundred`
            : `${hundreds} hundred and ${numberToWords(num % 100n)}`;
    }
    else {
        let scaleIndex = 0;
        let scaleValue = 1000n;
        while (scaleValue <= num) {
            scaleIndex++;
            scaleValue *= 1000n;
        }
        scaleValue /= 1000n; // Reset to previous scale value
        const scaleWord = scales[scaleIndex];
        const scaleNumber = num / scaleValue;
        const remainder = num % scaleValue;
        return isExactMultiple(num, scaleValue)
            ? `${numberToWords(scaleNumber)} ${scaleWord}`
            : `${numberToWords(scaleNumber)} ${scaleWord}, ${numberToWords(remainder)}`;
    }
}
//# sourceMappingURL=numbers.js.map