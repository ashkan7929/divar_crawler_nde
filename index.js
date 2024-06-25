const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot is alive");
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const botToken = '7234549003:AAEMjTuJ2GyATZAKdElKv4nsNFXTkX3O59U'; // Replace with your actual bot token
const bot = new TelegramBot(botToken, { polling: true });

let chatId; // Variable to store the chat ID
let urlToFetch; // Variable to store the URL user wants to fetch data from
let deposit; // Variable to store the deposit amount
let rent; // Variable to store the rent amount
let perHundred; // Variable to store the per hundred amount
let isRunning = true; // Flag to control the running state of the bot
let currentState = 'idle'; // Variable to track the current state of the conversation

const processedTokens = new Set();

const defaultUrl = 'https://divar.ir/s/tehran/rent-apartment/ajudaniye?districts=1028%2C127%2C138%2C139%2C159%2C170%2C173%2C208%2C210%2C286%2C300%2C301%2C302%2C315%2C360%2C42%2C48%2C55%2C56%2C61%2C62%2C63%2C64%2C65%2C658%2C66%2C67%2C68%2C70%2C71%2C72%2C74%2C75%2C78%2C81%2C84%2C85%2C86%2C87%2C88%2C90%2C920%2C922%2C925%2C929%2C930%2C931%2C934%2C938%2C939%2C941%2C95%2C96&credit=-700000000&rent=-30000000&size=60-&rooms=2&floor=0-';
const defaultDeposit = 700000000;
const defaultRent = 30000000;
const defaultPerHundred = 3000000;

// Function to convert Persian digits to Arabic digits
const persianToArabicDigits = (persianStr) => {
    const persianDigitMap = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return persianStr.replace(/[۰-۹]/g, (char) => persianDigitMap[char] || char);
}

// Function to extract numeric value from Persian string
const extractNumber = (persianString) => {
    let convertedString = persianToArabicDigits(persianString);
    convertedString = convertedString.replace(/[^\d]/g, '');
    return parseInt(convertedString, 10) || 0;
}

// Function to format number with commas
const formatNumberWithCommas = (number) => {
    return number.toLocaleString('en-US');
}

// Function to convert deposit to rent based on a formula
const convertDepositToRent = (deposit, perHundred) => {
    return (deposit * perHundred) / 100000000;
};

// Function to check if all digits in a number are the same
const areAllDigitsSame = (num) => {
    const numStr = num.toString();
    const firstDigit = numStr[0];
    return numStr.split('').every(digit => digit === firstDigit);
};

// Function to check if an article meets suitability criteria
const isSuitableHandler = ({ deposit, rent, maximumDeposit, maximumRent, perHundred, title }) => {
    if (title.includes('همخانه') && title.includes('همخونه'))
        return {
            why: "this is share home",
            result: false
        }
    if (deposit > maximumDeposit || rent > maximumRent) {
        return {
            why: `deposit is more than ${formatNumberWithCommas(maximumDeposit)} or rent is more than ${maximumRent}`,
            result: false,
        };
    }
    if (convertDepositToRent(deposit, perHundred) + rent > maximumRent) {
        return {
            why: `converted: ${formatNumberWithCommas(convertDepositToRent(deposit, perHundred))} + ${rent} is more than ${maximumRent}`,
            result: false,
        };
    }
    if (rent === 0 && deposit === 0) {
        return {
            why: "invalid article",
            result: false,
        };
    }
    if (areAllDigitsSame(deposit) || areAllDigitsSame(rent)) {
        return {
            why: "invalid article",
            result: false,
        };
    }
    return {
        why: "",
        result: true
    };
};

// Event listener for incoming messages
bot.on('message', async (msg) => {
    chatId = msg.chat.id; // Store chat ID when user starts the chat

    if (msg.text === "/start") {
        isRunning = true; // Set running flag to true
        currentState = 'awaitingUrl'; // Set the state to awaiting URL
        bot.sendMessage(chatId, `Welcome ${msg.from.first_name}! Please enter the URL to crawl or use the default URL.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Use default URL', callback_data: 'use_default_url' }]
                ]
            }
        });
    } else if (msg.text === "/stop") {
        if (isRunning) {
            isRunning = false; // Set running flag to false
            processedTokens.clear(); // Clear processed tokens
            currentState = 'idle'; // Reset state
            bot.sendMessage(chatId, "Bot stopped. All data has been cleared.", {
                reply_markup: {
                    keyboard: [['/start']], // Show the "Start" button
                }
            });
        } else {
            bot.sendMessage(chatId, "Bot is not currently running.");
        }
    } else if (currentState === 'awaitingUrl' && msg.text.startsWith('https://divar.ir/')) {
        urlToFetch = msg.text;
        currentState = 'awaitingDeposit'; // Set the state to awaiting deposit
        console.log(currentState);
        bot.sendMessage(chatId, "Please enter the deposit amount (in numbers) or use the default deposit:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default deposit (${defaultDeposit})`, callback_data: 'use_default_deposit' }]
                ]
            }
        });
    } else if (currentState === 'awaitingDeposit' && !isNaN(parseInt(msg.text))) {
        deposit = parseInt(msg.text * 1000000);
        currentState = 'awaitingRent'; // Set the state to awaiting rent
        console.log(currentState);
        bot.sendMessage(chatId, "Please enter the rent amount (in numbers) or use the default rent:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default rent (${defaultRent})`, callback_data: 'use_default_rent' }]
                ]
            }
        });
    } else if (currentState === 'awaitingRent' && !isNaN(parseInt(msg.text))) {
        rent = parseInt(msg.text * 1000000);
        currentState = 'awaitingPerHundred'; // Set the state to awaiting rent
        console.log(currentState);
        bot.sendMessage(chatId, "Please enter per hundred (in numbers) or use the default value:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default per hundred (${defaultPerHundred})`, callback_data: 'use_default_perHundred' }]
                ]
            }
        });
    } else if (currentState === 'awaitingPerHundred' && !isNaN(parseInt(msg.text))) {
        perHundred = parseInt(msg.text * 1000000)
        currentState = 'idle'; // Reset state
        bot.sendMessage(chatId, `Fetching data from: ${urlToFetch}, Deposit: ${formatNumberWithCommas(deposit)}, rent: ${formatNumberWithCommas(rent)} and per hundred ${formatNumberWithCommas(perHundred)} cost from rent...`)
        fetchData(urlToFetch, deposit, rent, perHundred);
    } else if (isRunning) {
        bot.sendMessage(chatId, "Invalid input. Please enter a correct value.");
    }
});

// Handle button clicks
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    if (callbackQuery.data === 'use_default_url') {
        urlToFetch = defaultUrl;
        currentState = 'awaitingDeposit'; // Set the state to awaiting deposit
        bot.sendMessage(chatId, "Please enter the deposit amount (in numbers) or use the default deposit:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default deposit (${defaultDeposit})`, callback_data: 'use_default_deposit' }]
                ]
            }
        });
    } else if (callbackQuery.data === 'use_default_deposit') {
        deposit = defaultDeposit;
        currentState = 'awaitingRent'; // Set the state to awaiting rent
        bot.sendMessage(chatId, "Please enter the rent amount (in numbers) or use the default rent:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default rent (${defaultRent})`, callback_data: 'use_default_rent' }]
                ]
            }
        });
    } else if (callbackQuery.data === 'use_default_rent') {
        rent = defaultRent;
        currentState = 'awaitingPerHundred'; // Set the state to awaiting per hundred
        bot.sendMessage(chatId, "Please enter per hundred (in numbers) or use the default value:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Use default per hundred (${defaultPerHundred})`, callback_data: 'use_default_perHundred' }]
                ]
            }
        });
    } else if (callbackQuery.data === 'use_default_perHundred') {
        perHundred = defaultPerHundred;
        currentState = 'idle'; // Reset state
        bot.sendMessage(chatId, `Fetching data from: ${urlToFetch}, Deposit: ${formatNumberWithCommas(deposit)}, rent: ${formatNumberWithCommas(rent)} and per hundred ${formatNumberWithCommas(perHundred)} cost from rent...`)
        fetchData(urlToFetch, deposit, rent, perHundred);
    }
});

// Function to fetch data from Divar URL
const fetchData = async (url, deposit, rent, perHundred) => {
    if (!isRunning) return; // Check if the bot is running before proceeding
    console.log("Fetching data from:", url);
    try {
        const response = await axios.get(url);
        if (response.status !== 200) {
            console.log("Error fetching data. Status:", response.status);
            return;
        }
        processHtml(response.data, deposit, rent, perHundred);
    } catch (err) {
        console.log("Error fetching data:", err);
    }
};

// Function to process HTML content and extract relevant information
const processHtml = async (html, deposit, rent, perHundred) => {
    if (!isRunning) return; // Check if the bot is running before proceeding
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
        const suitableCheckData = isSuitableHandler({
            deposit: articleDeposit,
            rent: articleRent,
            maximumDeposit: deposit,
            maximumRent: rent,
            perHundred: perHundred,
            title
        })
        const newArticle = {
            title,
            deposit: articleDeposit,
            rent: articleRent,
            token,
            picture,
            href,
            isSuitable: suitableCheckData.result,
            whyIsNotSuitable: suitableCheckData.why
        };
        console.log(newArticle);
        if (newArticle.isSuitable && !processedTokens.has(newArticle.token)) {
            const articleMessage = `
                Title: ${newArticle.title}
                Deposit: ${formatNumberWithCommas(newArticle.deposit)}
                Rent: ${formatNumberWithCommas(newArticle.rent)}
                URL: ${newArticle.href}
            `;
            bot.sendMessage(chatId, articleMessage);
            processedTokens.add(newArticle.token);
        }
    });

    // Fetch data again after 15 seconds if the bot is still running
    if (isRunning) {
        setTimeout(() => {
            fetchData(urlToFetch, deposit, rent, perHundred);
        }, 15000);
    }
};

console.log("Bot is running...");
