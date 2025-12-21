// Load environment variables from the Render setup (not a local .env file)
require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');
const DETH_ABI = require('./deth_abi.json');

// --- Contract & Token Configuration ---
const TOKEN_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const TOKEN_DECIMALS = 18;
const TOKEN_SYMBOL = "dETH";
const ETHERSCAN_BASE_URL = "https://sepolia.etherscan.io/tx/";

// --- API Keys & IDs (Pulled from Render's Environment Variables) ---
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- Setup ---
if (!RPC_URL || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("CRITICAL ERROR: One or more environment variables are missing. Check your Render configuration.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, DETH_ABI, provider);

// Function to send the Telegram message using Markdown for formatting
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown', // Enables **bold** and [link](url) formatting
            disable_web_page_preview: true // Makes the transaction link cleaner
        });
        console.log("Telegram message sent successfully!");
    } catch (error) {
        console.error("Error sending Telegram message. Check BOT_TOKEN and CHAT_ID:", error.message);
    }
}

// Function to start listening for the event
function startMonitoring() {
    console.log(`Starting to monitor contract ${TOKEN_CONTRACT_ADDRESS} for 'Mint' events...`);

    // Listen for the 'Mint' event
    contract.on("Mint", async (to, amount, event) => {
        
        // 1. Format the minted value
        const humanReadableAmount = ethers.formatUnits(amount, TOKEN_DECIMALS);
        
        // 2. Construct the Etherscan transaction link
        const txHash = event.log.transactionHash;
        const txLink = `${ETHERSCAN_BASE_URL}${txHash}`;

        // 3. Construct the desired message text
        // Your requested format: "💀 dETH was just berthed! X (value) of Dethereum was minted. (link to transaction)"
        const message = 
            `💀 **${TOKEN_SYMBOL} was just berthed!**\n\n` +
            `*${humanReadableAmount}* of Dethereum was minted.\n\n` +
            `[Link to Transaction](${txLink})`;

        console.log(`--- Mint Detected ---`);
        console.log(`Amount: ${humanReadableAmount} ${TOKEN_SYMBOL}`);
        console.log(`To: ${to}`);
        console.log(`Tx Hash: ${txHash}`);
        
        // 4. Send the formatted message to Telegram
        await sendTelegramMessage(message);
    });

    // Handle initial connection status
    provider.getNetwork().then(network => {
        console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    }).catch(err => {
        console.error("Failed to connect to the RPC provider. Check your SEPOLIA_RPC_URL.", err);
    });
}

// Start the whole process
startMonitoring();
