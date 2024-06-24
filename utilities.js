function persianToArabicDigits(persianStr) {
    const persianDigitMap = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return persianStr.replace(/[۰-۹]/g, (char) => persianDigitMap[char]);
}

export function extractNumber(persianString) {
    // Convert Persian digits to Arabic digits
    let convertedString = persianToArabicDigits(persianString);

    // Remove non-numeric characters except for digits
    convertedString = convertedString.replace(/[^\d]/g, '');

    // Convert the cleaned string to an integer
    return parseInt(convertedString, 10) || 0;
}

export function formatNumberWithCommas(number) {
    return number.toLocaleString('en-US');
}

const convertDepositToRent = (deposit) => {
    return (deposit * 4000000) / 100000000
}

const areAllDigitsSame = (num) => {
    const numStr = num.toString();
    const firstDigit = numStr[0];
    return numStr.split('').every(digit => digit === firstDigit);
};

export const isSuitableHandler = ({ deposit, rent }) => {
    if (deposit > 400000000)
        return false
    if (rent > 30000000)
        return false
    if (convertDepositToRent(deposit) + rent > 30000000)
        return false
    if (rent === 0 && deposit === 0)
        return false
    if (areAllDigitsSame(deposit))
        return false;
    if (areAllDigitsSame(rent))
        return false;

    return true
}