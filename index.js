const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Replace the URL below with the direct, public link to your GIF/animation file.
const MINT_ANIMATION_URL = "";

// --- Load ABI Fragment from JSON File ---
const fs = require('fs');
const abiFragment = JSON.parse(fs.readFileSync('./deth_abi.json', 'utf8'));

// --- GLOBAL VARIABLES FOR RECONNECTION ---
let provider;
let contract;

// --- Function to handle Telegram Notification (Using sendAnimation) ---
async function sendTelegramNotification(user, amount) {
    const valueEth = ethers.formatUnits(amount, 18);
    const explorerUrl = `https://sepolia.etherscan.io/address/${user}`;
    
    // The message becomes the 'caption' of the animation/GIF
    const caption = `
💀 **dETH was just berthed!**
*${valueEth}* of Dethereum minted by:
\`${user}\`
[View on Etherscan](${explorerUrl})
    `;

    // 💡 NEW API ENDPOINT: 'sendAnimation' 💡
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`;
    
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            // 💡 NEW PARAMETER: 'animation' 💡
            animation: MINT_ANIMATION_URL, // <-- Your GIF/Animation URL
            caption: caption,               // <-- Your text message (caption)
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        console.log(`Telegram animation/GIF notification sent for Mint event to ${user}`);
    } catch (error) {
        console.error('Error sending Telegram animation/GIF notification:', error.message);
    }
}

// --- Main Listening and Reconnection Function ---
function startListening() {
    // 1. Remove any existing listeners before creating a new provider/contract
    if (contract) {
        contract.removeAllListeners();
        console.log('Removed existing contract listeners.');
    }

    // 2. Setup WebSocket Provider
    try {
        provider = new ethers.WebSocketProvider(RPC_URL);
        console.log(`Attempting connection to ${RPC_URL}...`);
    } catch (error) {
        console.error("Provider initialization error:", error.message);
        setTimeout(startListening, 5000); // Retry connection on initialization error
        return;
    }

    // 3. Handle connection close for automatic reconnection
    provider.websocket.on('close', (code, reason) => {
        console.error(`WebSocket closed. Code: ${code}. Reason: ${reason}`);
        console.log('Attempting to reconnect in 5 seconds...');
        setTimeout(startListening, 5000);
    });

    // 4. Handle connection error
    provider.websocket.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        // The 'close' handler will typically run right after, handling the reconnection.
    });

    // 5. Connect to the contract and start listening
    contract = new ethers.Contract(CONTRACT_ADDRESS, abiFragment, provider);

    // 6. Wait for a connection before logging success and starting the listener
    provider.getNetwork()
        .then(network => {
            console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`Starting to monitor contract ${CONTRACT_ADDRESS} for Mint events...`);

            contract.on("Mint", (user, amount, ethAmount, event) => {
                console.log('--- Mint Detected ---');
                console.log(`User: ${user}, Amount: ${amount.toString()}, EthAmount: ${ethAmount.toString()}`);
                sendTelegramNotification(user, amount);
            });
        })
        .catch(error => {
            console.error("Failed to connect and get network information:", error.message);
            console.log('Retrying connection in 5 seconds...');
            setTimeout(startListening, 5000);
        });
}

// Start the process
(async () => {
    // Critical check for environment variables
    if (!RPC_URL || !CONTRACT_ADDRESS || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("CRITICAL ERROR: One or more environment variables are missing. Check your Render configuration.");
        return;
    }
    startListening();
})();
