const ethers = require('ethers');
const axios = require('axios');
require('dotenv').config();

// --- Environment Variables ---
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- Animation/GIF URL ---
// You MUST replace this with the direct HTTPS link to your animation file (.gif or .mp4)
const MINT_ANIMATION_URL = "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnpkaWNxdzBmdmpmZXNndGhwdDRibWFidml3Mzc5MmxyNXdxbHgwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rE79fD41FssPVXarj5/giphy.gif";

// --- Load ABI Fragment from JSON File ---
const fs = require('fs');
const abiFragment = JSON.parse(fs.readFileSync('./deth_abi.json', 'utf8'));

// --- GLOBAL VARIABLES FOR RECONNECTION ---
let provider;
let contract;

// --- Function to handle Telegram Notification (Uses sendAnimation) ---
// Now accepts the txHash to create a link
async function sendTelegramNotification(user, amount, txHash) { 
    const valueEth = ethers.formatUnits(amount, 18);
    
    // Construct the Etherscan Transaction URL using the hash
    const explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`; 
    
// --- Function to handle Telegram Notification (Uses sendAnimation) ---
// ... (function definition and setup)

    // The message is the 'caption' for the GIF/Animation
    const caption = `
💀 **dETH was just berthed!**
*${valueEth}* of Dethereum minted by:
\`${user}\`
[View Transaction](${explorerUrl})
    `;

// ... (rest of the function)

    // Telegram Bot API Endpoint for sending animations
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`;
    
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            animation: MINT_ANIMATION_URL,
            caption: caption,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        console.log(`Telegram animation/GIF notification sent for Tx: ${txHash}`);
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
        // Use WebSocketProvider for continuous, event-based monitoring
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
    });

    // 5. Connect to the contract and start listening
    contract = new ethers.Contract(CONTRACT_ADDRESS, abiFragment, provider);

    // 6. Wait for a connection before logging success and starting the listener
    provider.getNetwork()
        .then(network => {
            console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`Starting to monitor contract ${CONTRACT_ADDRESS} for Mint events...`);

            // The 'event' object (last parameter) contains the transaction hash
            contract.on("Mint", (user, amount, ethAmount, event) => {
                
                // Extract the transaction hash from the event log
                const txHash = event.log.transactionHash; 

                console.log('--- Mint Detected ---');
                console.log(`User: ${user}, Amount: ${amount.toString()}, EthAmount: ${ethAmount.toString()}`);
                console.log(`Transaction Hash: ${txHash}`);
                
                // Pass the transaction hash to the sender function
                sendTelegramNotification(user, amount, txHash); 
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
