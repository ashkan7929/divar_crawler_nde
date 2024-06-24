const axios = require('axios');
const cheerio = require('cheerio');

const botToken = '7282286025:AAFLMTYQZE2GsuVGQeFYvi2vFAhvoLAen3o'; // Replace with your actual bot token

const apiUrl = `https://api.telegram.org/bot${botToken}`;

const processedTokens = new Set();
let urlToFetch; // Variable to store the URL user wants to fetch data from
let deposit; // Variable to store the deposit amount
let rent; // Variable to store the rent amount
let perHundred; // Variable to store the per hundred amount
let currentState = 'idle'; // Variable to track the current state of the conversation

const persianToArabicDigits = (persianStr) => {
    const persianDigitMap = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return persianStr.replace(/[۰-۹]/g, (char) => persianDigitMap[char] || char);
}

const extractNumber = (persianString) => {
    let convertedString = persianToArabicDigits(persianString);
    convertedString = convertedString.replace(/[^\d]/g, '');
    return parseInt(convertedString, 10) || 0;
}

const formatNumberWithCommas = (number) => {
    return number.toLocaleString('en-US');
}

const convertDepositToRent = (deposit, perHundred) => {
    return (deposit * perHundred) / 100000000;
};

const areAllDigitsSame = (num) => {
    const numStr = num.toString();
    const firstDigit = numStr[0];
    return numStr.split('').every(digit => digit === firstDigit);
};

const isSuitableHandler = ({ deposit, rent, maximumDeposit, maximumRent, perHundred }) => {
    if (deposit > maximumDeposit || rent > maximumRent) {
        return false;
    }
    if (convertDepositToRent(deposit, perHundred) + rent > rent) {
        return false;
    }
    if (rent === 0 && deposit === 0) {
        return false;
    }
    if (areAllDigitsSame(deposit) || areAllDigitsSame(rent)) {
        return false;
    }
    return true;
};

const fetchData = async (url, deposit, rent, perHundred, chatId) => {
    console.log("Fetching data from:", url);
    await sendMessage(chatId, `Fetching data from: ${url}, Deposit: ${formatNumberWithCommas(deposit)}, Rent: ${formatNumberWithCommas(rent)}, Per Hundred: ${formatNumberWithCommas(perHundred)}`);
    try {
        const response = await axios.get(url);
        if (response.status !== 200) {
            console.log("Error fetching data. Status:", response.status);
            return;
        }
        processHtml(response.data, deposit, rent, perHundred, chatId);
    } catch (err) {
        console.log("Error fetching data:", err);
    }
};

const processHtml = async (html, deposit, rent, perHundred, chatId) => {
    const $ = cheerio.load(html);

    $('.post-list__widget-col-c1444').each(function () {
        const token = $(this).find('article.kt-post-card').attr('token') || '';
        const post = $(this).find(".kt-post-card__info");
        const title = $(post).find('h2.kt-post-card__title').text();
        const descriptionDivs = $(post).find('div.kt-post-card__description');

        const postDeposit = $(descriptionDivs[0]).text().trim();
        const postRent = $(descriptionDivs[1]).text().trim();

        const picture = $(this).find('.kt-post-card-thumbnail img').attr('data-src') || '';
        const href = "https://divar.ir" + $(this).find('a').attr('href') || '';

        const articleDeposit = extractNumber(postDeposit);
        const articleRent = extractNumber(postRent);

        const newArticle = {
            title,
            deposit: articleDeposit,
            rent: articleRent,
            token,
            picture,
            href,
            isSuitable: !title.includes('همخانه') && !title.includes('همخونه') && isSuitableHandler({
                deposit: articleDeposit,
                rent: articleRent,
                maximumDeposit: deposit,
                maximumRent: rent,
                perHundred: perHundred
            })
        };

        if (token && !processedTokens.has(token) && newArticle.isSuitable) {
            const articleMessage = `
        Title: ${newArticle.title}
        Deposit: ${formatNumberWithCommas(newArticle.deposit)}
        Rent: ${formatNumberWithCommas(newArticle.rent)}
        URL: ${newArticle.href}
      `;
            sendMessage(chatId, articleMessage);
            processedTokens.add(newArticle.token);
        }
    });

    // Fetch data again after 15 seconds
    setTimeout(() => {
        fetchData(urlToFetch, deposit, rent, perHundred, chatId);
    }, 15000);
};

const sendMessage = async (chatId, text) => {
    await axios.post(`${apiUrl}/sendMessage`, {
        chat_id: chatId,
        text
    });
};

module.exports = async (req, res) => {
    const { body } = req;

    if (body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text;

        if (text === "/start") {
            currentState = 'awaitingUrl'; // Set the state to awaiting URL
            sendMessage(chatId, "Welcome express! Please enter the URL to crawl.");
        } else if (text === "/stop") {
            processedTokens.clear(); // Clear processed tokens
            currentState = 'idle'; // Reset state
            sendMessage(chatId, "Bot stopped. All data has been cleared.");
        } else if (currentState === 'awaitingUrl' && text.startsWith('https://divar.ir/')) {
            urlToFetch = text;
            currentState = 'awaitingDeposit'; // Set the state to awaiting deposit
            sendMessage(chatId, "Please enter the deposit amount (in numbers):");
        } else if (currentState === 'awaitingDeposit' && !isNaN(parseInt(text))) {
            deposit = parseInt(text);
            currentState = 'awaitingRent'; // Set the state to awaiting rent
            sendMessage(chatId, "Please enter the rent amount (in numbers):");
        } else if (currentState === 'awaitingRent' && !isNaN(parseInt(text))) {
            rent = parseInt(text);
            currentState = 'awaitingPerHundred'; // Set the state to awaiting rent
            sendMessage(chatId, "Please enter per hundred (in numbers):");
        } else if (currentState === 'awaitingPerHundred' && !isNaN(parseInt(text))) {
            perHundred = parseInt(text)
            currentState = 'idle'; // Reset state
            fetchData(urlToFetch, deposit, rent, perHundred, chatId);
        } else {
            sendMessage(chatId, "Invalid input. Please enter a correct value.");
        }
    }

    res.status(200).send('OK');
};
