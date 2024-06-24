const axios = require('axios');
const cheerio = require('cheerio');

// Your Telegram bot token
const botToken = '7282286025:AAFLMTYQZE2GsuVGQeFYvi2vFAhvoLAen3o'; // Replace with your actual bot token
const apiUrl = `https://api.telegram.org/bot${botToken}`;

// Example logic for handling Telegram messages
module.exports = async (req, res) => {
    const { body } = req;

    if (body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text;

        // Handle incoming messages
        if (text === '/start') {
            await sendMessage(chatId, 'Hello! Bot is running...');
        } else {
            await sendMessage(chatId, `Received: ${text}`);
        }
    }

    res.status(200).send('OK');
};

// Example function to send messages via Telegram API
async function sendMessage(chatId, text) {
    try {
        await axios.post(`${apiUrl}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
        console.log('Message sent successfully:', text);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
