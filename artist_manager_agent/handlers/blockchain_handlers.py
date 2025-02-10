"""Blockchain functionality handlers for the Artist Manager Bot."""
from typing import List
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ForceReply
from telegram.ext import (
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    BaseHandler,
    ConversationHandler,
    MessageHandler,
    filters
)
from .base_handler import BaseHandlerMixin
from datetime import datetime
import uuid
from typing import Dict, Optional
from telegram import Message
from ..models import NetworkType

logger = logging.getLogger(__name__)

# Conversation states for wallet
AWAITING_WALLET_ADDRESS = "AWAITING_WALLET_ADDRESS"
AWAITING_WALLET_NETWORK = "AWAITING_WALLET_NETWORK"
AWAITING_SEND_ADDRESS = "AWAITING_SEND_ADDRESS"
AWAITING_SEND_AMOUNT = "AWAITING_SEND_AMOUNT"
AWAITING_SEND_ASSET = "AWAITING_SEND_ASSET"

# Conversation states for NFT
AWAITING_NFT_NAME = "AWAITING_NFT_NAME"
AWAITING_NFT_SYMBOL = "AWAITING_NFT_SYMBOL"
AWAITING_NFT_DESCRIPTION = "AWAITING_NFT_DESCRIPTION"
AWAITING_NFT_ARTWORK = "AWAITING_NFT_ARTWORK"
AWAITING_NFT_PRICE = "AWAITING_NFT_PRICE"

# Conversation states for token
AWAITING_TOKEN_NAME = "AWAITING_TOKEN_NAME"
AWAITING_TOKEN_SYMBOL = "AWAITING_TOKEN_SYMBOL"
AWAITING_TOKEN_SUPPLY = "AWAITING_TOKEN_SUPPLY"
AWAITING_TOKEN_DECIMALS = "AWAITING_TOKEN_DECIMALS"

# Conversation states for token swap
(
    AWAITING_SWAP_FROM_TOKEN,
    AWAITING_SWAP_TO_TOKEN,
    AWAITING_SWAP_AMOUNT,
    AWAITING_SWAP_ROUTE,
    AWAITING_GAS_PRICE,
    AWAITING_TX_FILTER,
    AWAITING_TX_DATES
) = range(7)

class BlockchainHandlers(BaseHandlerMixin):
    """Handlers for blockchain-related functionality."""
    
    group = "blockchain"  # Handler group for registration
    
    def __init__(self, bot):
        self.bot = bot

    def get_handlers(self) -> List[BaseHandler]:
        """Get blockchain-related handlers."""
        return [
            CommandHandler("blockchain", self.show_blockchain_options),
            CommandHandler("wallet", self.handle_wallet),
            CommandHandler("nft", self.handle_deploy_nft),
            CommandHandler("token", self.handle_deploy_token),
            CallbackQueryHandler(self.handle_blockchain_callback, pattern="^blockchain_"),
            
            # Token swap conversation handler
            ConversationHandler(
                entry_points=[CommandHandler("swap", self.swap_tokens)],
                states={
                    AWAITING_SWAP_FROM_TOKEN: [
                        CallbackQueryHandler(
                            self.handle_swap_from_token,
                            pattern="^blockchain_swap_from_"
                        )
                    ],
                    AWAITING_SWAP_TO_TOKEN: [
                        CallbackQueryHandler(
                            self.handle_swap_to_token,
                            pattern="^blockchain_swap_to_"
                        )
                    ],
                    AWAITING_SWAP_AMOUNT: [
                        MessageHandler(
                            filters.TEXT & ~filters.COMMAND,
                            self.handle_swap_amount
                        )
                    ],
                    AWAITING_SWAP_ROUTE: [
                        CallbackQueryHandler(
                            self.handle_swap_route,
                            pattern="^blockchain_swap_route_"
                        ),
                        CallbackQueryHandler(
                            self.cancel_swap,
                            pattern="^blockchain_swap_cancel$"
                        )
                    ]
                },
                fallbacks=[
                    CommandHandler("cancel", self.cleanup_operation),
                    CallbackQueryHandler(
                        self.cleanup_operation,
                        pattern="^blockchain_cancel$"
                    )
                ]
            ),
            
            # Gas price conversation handler
            ConversationHandler(
                entry_points=[
                    CallbackQueryHandler(
                        self.handle_gas_action,
                        pattern="^blockchain_gas_custom$"
                    )
                ],
                states={
                    AWAITING_GAS_PRICE: [
                        MessageHandler(
                            filters.TEXT & ~filters.COMMAND,
                            self.handle_gas_price_input
                        )
                    ]
                },
                fallbacks=[
                    CommandHandler("cancel", self.cleanup_operation),
                    CallbackQueryHandler(
                        self.cleanup_operation,
                        pattern="^blockchain_cancel$"
                    )
                ]
            ),
            
            # Transaction date range conversation handler
            ConversationHandler(
                entry_points=[
                    CallbackQueryHandler(
                        self.handle_tx_action,
                        pattern="^blockchain_tx_dates$"
                    )
                ],
                states={
                    AWAITING_TX_DATES: [
                        MessageHandler(
                            filters.TEXT & ~filters.COMMAND,
                            self.handle_tx_date_input
                        )
                    ]
                },
                fallbacks=[
                    CommandHandler("cancel", self.cleanup_operation),
                    CallbackQueryHandler(
                        self.cleanup_operation,
                        pattern="^blockchain_cancel$"
                    )
                ]
            ),
            
            # Callback query handlers
            CallbackQueryHandler(
                self.handle_tx_action,
                pattern="^blockchain_tx_"
            ),
            CallbackQueryHandler(
                self.handle_gas_action,
                pattern="^blockchain_gas_"
            ),
            CallbackQueryHandler(
                self.handle_tx_filter,
                pattern="^blockchain_tx_filter_"
            )
        ]

    async def show_blockchain_options(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Show blockchain-related options."""
        try:
            keyboard = [
                [
                    InlineKeyboardButton("Wallet", callback_data="blockchain_wallet"),
                    InlineKeyboardButton("Deploy NFT", callback_data="blockchain_nft")
                ],
                [
                    InlineKeyboardButton("Deploy Token", callback_data="blockchain_token"),
                    InlineKeyboardButton("Settings", callback_data="blockchain_settings")
                ]
            ]
            
            await update.message.reply_text(
                "🔗 Blockchain Options:\n\n"
                "• Manage your crypto wallet\n"
                "• Deploy NFT collections\n"
                "• Create custom tokens\n"
                "• Configure blockchain settings",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error showing blockchain options: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error loading blockchain options. Please try again later."
            )

    async def handle_wallet(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle wallet management."""
        try:
            keyboard = [
                [
                    InlineKeyboardButton("View Balance", callback_data="blockchain_wallet_balance"),
                    InlineKeyboardButton("Send", callback_data="blockchain_wallet_send")
                ],
                [
                    InlineKeyboardButton("Receive", callback_data="blockchain_wallet_receive"),
                    InlineKeyboardButton("History", callback_data="blockchain_wallet_history")
                ]
            ]
            
            await update.message.reply_text(
                "💼 Wallet Management:\n\n"
                "Select an option to manage your wallet:",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error handling wallet: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error accessing wallet functions. Please try again later."
            )

    async def handle_deploy_nft(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle NFT deployment."""
        try:
            keyboard = [
                [
                    InlineKeyboardButton("Create Collection", callback_data="blockchain_nft_create"),
                    InlineKeyboardButton("Upload Art", callback_data="blockchain_nft_upload")
                ],
                [
                    InlineKeyboardButton("Set Pricing", callback_data="blockchain_nft_price"),
                    InlineKeyboardButton("Deploy", callback_data="blockchain_nft_deploy")
                ]
            ]
            
            await update.message.reply_text(
                "🎨 NFT Deployment:\n\n"
                "Create and deploy your NFT collection:",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error handling NFT deployment: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error with NFT deployment. Please try again later."
            )

    async def handle_deploy_token(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle token deployment."""
        try:
            keyboard = [
                [
                    InlineKeyboardButton("Create Token", callback_data="blockchain_token_create"),
                    InlineKeyboardButton("Set Supply", callback_data="blockchain_token_supply")
                ],
                [
                    InlineKeyboardButton("Configure", callback_data="blockchain_token_configure"),
                    InlineKeyboardButton("Deploy", callback_data="blockchain_token_deploy")
                ]
            ]
            
            await update.message.reply_text(
                "🪙 Token Deployment:\n\n"
                "Create and deploy your custom token:",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error handling token deployment: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error with token deployment. Please try again later."
            )

    async def handle_blockchain_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle blockchain-related callbacks."""
        try:
            query = update.callback_query
            await query.answer()
            
            action = query.data.replace("blockchain_", "")
            
            if action.startswith("wallet_"):
                await self._handle_wallet_action(query, action)
            elif action.startswith("nft_"):
                await self._handle_nft_action(query, action)
            elif action.startswith("token_"):
                await self._handle_token_action(query, action)
            else:
                await query.message.reply_text("This feature is coming soon!")
                
        except Exception as e:
            logger.error(f"Error handling blockchain callback: {str(e)}")
            await update.effective_message.reply_text(
                "Sorry, there was an error processing your request. Please try again later."
            )

    async def _handle_wallet_action(self, query: CallbackQuery, action: str) -> None:
        """Handle wallet-specific actions."""
        action = action.replace("wallet_", "")
        # Implement wallet actions (balance, send, receive, history)
        await query.message.reply_text(f"Wallet {action} feature coming soon!")

    async def _handle_nft_action(self, query: CallbackQuery, action: str) -> None:
        """Handle NFT-specific actions."""
        action = action.replace("nft_", "")
        # Implement NFT actions (create, upload, price, deploy)
        await query.message.reply_text(f"NFT {action} feature coming soon!")

    async def _handle_token_action(self, query: CallbackQuery, action: str) -> None:
        """Handle token-specific actions."""
        action = action.replace("token_", "")
        # Implement token actions (create, supply, configure, deploy)
        await query.message.reply_text(f"Token {action} feature coming soon!")

    async def show_transaction_history(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Show transaction history."""
        try:
            # Get transaction history
            transactions = await self.bot.blockchain_manager.get_transaction_history()
            
            if not transactions:
                await update.message.reply_text(
                    "No transactions found in history."
                )
                return

            # Create summary message
            message = "📜 Transaction History\n\n"
            
            for tx in transactions[:5]:  # Show last 5 transactions
                status_emoji = {
                    "success": "✅",
                    "failed": "❌",
                    "pending": "⏳"
                }.get(tx.status, "❓")
                
                message += (
                    f"{status_emoji} {tx.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
                    f"Type: {tx.asset.upper()}\n"
                    f"Amount: {tx.amount}\n"
                    f"Gas Used: {tx.gas_used} @ {tx.gas_price} gwei\n"
                    f"Hash: {tx.tx_hash[:6]}...{tx.tx_hash[-4:]}\n\n"
                )
                
            # Add action buttons
            keyboard = [
                [
                    InlineKeyboardButton("View All", callback_data="blockchain_tx_all"),
                    InlineKeyboardButton("Export", callback_data="blockchain_tx_export")
                ],
                [
                    InlineKeyboardButton("Filter by Asset", callback_data="blockchain_tx_filter"),
                    InlineKeyboardButton("Date Range", callback_data="blockchain_tx_dates")
                ],
                [InlineKeyboardButton("Back to Wallet", callback_data="blockchain_wallet")]
            ]
            
            await update.message.reply_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error showing transaction history: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error loading transaction history. Please try again later."
            )

    async def estimate_gas(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Estimate gas for transaction."""
        try:
            # Get operation details from context
            operation = context.user_data.get("pending_operation")
            if not operation:
                await update.message.reply_text(
                    "No pending operation to estimate gas for."
                )
                return

            # Get gas estimate
            estimate = await self.bot.blockchain_manager.estimate_gas(
                operation=operation["type"],
                params=operation["params"]
            )
            
            # Show estimate
            message = (
                "⛽ Gas Estimate\n\n"
                f"Operation: {estimate.operation}\n"
                f"Gas Limit: {estimate.gas_limit:,}\n"
                f"Gas Price: {estimate.gas_price} gwei\n"
                f"Total Cost: {estimate.total_cost:.6f} ETH\n\n"
                "Would you like to proceed with the transaction?"
            )
            
            keyboard = [
                [
                    InlineKeyboardButton("Proceed", callback_data="blockchain_tx_proceed"),
                    InlineKeyboardButton("Cancel", callback_data="blockchain_tx_cancel")
                ],
                [
                    InlineKeyboardButton("Refresh Price", callback_data="blockchain_gas_refresh"),
                    InlineKeyboardButton("Set Custom Gas", callback_data="blockchain_gas_custom")
                ]
            ]
            
            await update.message.reply_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error estimating gas: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error estimating gas. Please try again later."
            )

    async def swap_tokens(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle token swaps."""
        try:
            # Show token selection
            message = (
                "🔄 Token Swap\n\n"
                "Select the token you want to swap from:"
            )
            
            # Get token list
            keyboard = [
                [
                    InlineKeyboardButton("ETH", callback_data="blockchain_swap_from_eth"),
                    InlineKeyboardButton("WETH", callback_data="blockchain_swap_from_weth")
                ],
                [
                    InlineKeyboardButton("USDC", callback_data="blockchain_swap_from_usdc"),
                    InlineKeyboardButton("Custom", callback_data="blockchain_swap_from_custom")
                ]
            ]
            
            await update.message.reply_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error showing swap options: {str(e)}")
            await update.message.reply_text(
                "Sorry, there was an error loading swap options. Please try again later."
            )

    async def handle_swap_from_token(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
        """Handle from token selection."""
        query = update.callback_query
        await query.answer()
        
        token = query.data.replace("blockchain_swap_from_", "")
        context.user_data["swap"] = {"token_in": token}
        
        # Show to token selection
        keyboard = [
            [
                InlineKeyboardButton("ETH", callback_data="blockchain_swap_to_eth"),
                InlineKeyboardButton("WETH", callback_data="blockchain_swap_to_weth")
            ],
            [
                InlineKeyboardButton("USDC", callback_data="blockchain_swap_to_usdc"),
                InlineKeyboardButton("Custom", callback_data="blockchain_swap_to_custom")
            ]
        ]
        
        await query.message.edit_text(
            f"Selected: {token.upper()}\n\n"
            "Now select the token you want to swap to:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return AWAITING_SWAP_TO_TOKEN

    async def handle_swap_to_token(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
        """Handle to token selection."""
        query = update.callback_query
        await query.answer()
        
        token = query.data.replace("blockchain_swap_to_", "")
        context.user_data["swap"]["token_out"] = token
        
        await query.message.edit_text(
            f"Swapping {context.user_data['swap']['token_in'].upper()} to {token.upper()}\n\n"
            "How much would you like to swap? Enter the amount:",
            reply_markup=ForceReply(selective=True)
        )
        return AWAITING_SWAP_AMOUNT

    async def handle_swap_amount(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
        """Handle swap amount input."""
        try:
            amount = float(update.message.text.strip())
            swap_data = context.user_data["swap"]
            
            # Get swap routes
            routes = await self.bot.blockchain_manager.get_swap_routes(
                token_in=swap_data["token_in"],
                token_out=swap_data["token_out"],
                amount_in=str(amount)
            )
            
            if not routes:
                await update.message.reply_text(
                    "No swap routes found. Please try a different amount or token pair."
                )
                return ConversationHandler.END
                
            # Show route options
            message = (
                f"Found {len(routes)} routes for your swap:\n\n"
                f"Amount In: {amount} {swap_data['token_in'].upper()}\n"
            )
            
            keyboard = []
            for i, route in enumerate(routes):
                message += (
                    f"\nRoute {i+1}:\n"
                    f"Amount Out: {route['amount_out']} {swap_data['token_out'].upper()}\n"
                    f"Price Impact: {route['price_impact']}%\n"
                    f"Gas Estimate: {route['gas_estimate']} gwei\n"
                )
                
                keyboard.append([
                    InlineKeyboardButton(
                        f"Use Route {i+1}",
                        callback_data=f"blockchain_swap_route_{i}"
                    )
                ])
                
            keyboard.append([InlineKeyboardButton("Cancel", callback_data="blockchain_swap_cancel")])
            
            await update.message.reply_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return AWAITING_SWAP_ROUTE
            
        except ValueError:
            await update.message.reply_text(
                "Please enter a valid number amount:"
            )
            return AWAITING_SWAP_AMOUNT

    async def handle_swap_route(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Handle swap route selection and execute swap."""
        try:
            query = update.callback_query
            await query.answer()
            
            route_index = int(query.data.replace("blockchain_swap_route_", ""))
            swap_data = context.user_data.pop("swap")
            
            # Execute swap
            tx_hash = await self.bot.blockchain_manager.swap_tokens(
                token_in=swap_data["token_in"],
                token_out=swap_data["token_out"],
                amount_in=swap_data["amount_in"]
            )
            
            # Show confirmation
            keyboard = [
                [
                    InlineKeyboardButton("View Transaction", callback_data=f"blockchain_tx_{tx_hash}"),
                    InlineKeyboardButton("New Swap", callback_data="blockchain_swap")
                ],
                [InlineKeyboardButton("Back to Wallet", callback_data="blockchain_wallet")]
            ]
            
            await query.message.edit_text(
                "✅ Swap transaction submitted!\n\n"
                f"From: {swap_data['amount_in']} {swap_data['token_in'].upper()}\n"
                f"To: {swap_data['token_out'].upper()}\n"
                f"Transaction: {tx_hash[:6]}...{tx_hash[-4:]}\n\n"
                "What would you like to do next?",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return ConversationHandler.END
            
        except Exception as e:
            logger.error(f"Error executing swap: {str(e)}")
            await query.message.edit_text(
                "Sorry, there was an error executing your swap. Please try again later."
            )
            return ConversationHandler.END

    async def cancel_swap(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Cancel token swap."""
        if "swap" in context.user_data:
            context.user_data.pop("swap")
            
        await update.message.reply_text(
            "Swap cancelled. You can start over with /swap"
        )
        return ConversationHandler.END

    async def handle_tx_action(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle transaction-related actions."""
        query = update.callback_query
        await query.answer()
        
        action = query.data.replace("blockchain_tx_", "")
        
        if action == "all":
            # Show all transactions
            transactions = await self.bot.blockchain_manager.get_transaction_history(limit=None)
            message = "📜 All Transactions\n\n"
            
            for tx in transactions:
                status_emoji = {
                    "success": "✅",
                    "failed": "❌",
                    "pending": "⏳"
                }.get(tx.status, "❓")
                
                message += (
                    f"{status_emoji} {tx.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
                    f"Type: {tx.asset.upper()}\n"
                    f"Amount: {tx.amount}\n"
                    f"Gas Used: {tx.gas_used} @ {tx.gas_price} gwei\n"
                    f"Hash: {tx.tx_hash[:6]}...{tx.tx_hash[-4:]}\n\n"
                )
            
            await query.message.edit_text(
                message,
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                ]])
            )
            
        elif action == "export":
            # Export transactions to CSV
            try:
                transactions = await self.bot.blockchain_manager.get_transaction_history(limit=None)
                csv_data = "Timestamp,Type,Amount,Status,Gas Used,Gas Price,Hash\n"
                
                for tx in transactions:
                    csv_data += (
                        f"{tx.timestamp},{tx.asset},{tx.amount},{tx.status},"
                        f"{tx.gas_used},{tx.gas_price},{tx.tx_hash}\n"
                    )
                
                # Save CSV and send as document
                filename = f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                with open(filename, "w") as f:
                    f.write(csv_data)
                    
                await context.bot.send_document(
                    chat_id=update.effective_chat.id,
                    document=open(filename, "rb"),
                    filename=filename,
                    caption="Here's your transaction history export."
                )
                
            except Exception as e:
                logger.error(f"Error exporting transactions: {str(e)}")
                await query.message.edit_text(
                    "Sorry, there was an error exporting your transactions. Please try again later."
                )
                
        elif action == "filter":
            # Show asset filter options
            keyboard = [
                [
                    InlineKeyboardButton("ETH", callback_data="blockchain_tx_filter_eth"),
                    InlineKeyboardButton("WETH", callback_data="blockchain_tx_filter_weth")
                ],
                [
                    InlineKeyboardButton("USDC", callback_data="blockchain_tx_filter_usdc"),
                    InlineKeyboardButton("NFTs", callback_data="blockchain_tx_filter_nft")
                ],
                [InlineKeyboardButton("Back", callback_data="blockchain_tx_back")]
            ]
            
            await query.message.edit_text(
                "Select asset type to filter transactions:",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        elif action == "dates":
            # Show date range selector
            await query.message.edit_text(
                "Please enter the start date (YYYY-MM-DD):",
                reply_markup=ForceReply(selective=True)
            )
            return AWAITING_TX_DATES
            
        elif action == "back":
            # Return to transaction history view
            await self.show_transaction_history(update, context)

    async def handle_gas_action(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle gas-related actions."""
        query = update.callback_query
        await query.answer()
        
        action = query.data.replace("blockchain_gas_", "")
        
        if action == "refresh":
            # Refresh gas estimate
            operation = context.user_data.get("pending_operation")
            if not operation:
                await query.message.edit_text(
                    "No pending operation to estimate gas for."
                )
                return
                
            estimate = await self.bot.blockchain_manager.estimate_gas(
                operation=operation["type"],
                params=operation["params"]
            )
            
            message = (
                "⛽ Gas Estimate (Refreshed)\n\n"
                f"Operation: {estimate.operation}\n"
                f"Gas Limit: {estimate.gas_limit:,}\n"
                f"Gas Price: {estimate.gas_price} gwei\n"
                f"Total Cost: {estimate.total_cost:.6f} ETH\n\n"
                "Would you like to proceed with the transaction?"
            )
            
            keyboard = [
                [
                    InlineKeyboardButton("Proceed", callback_data="blockchain_tx_proceed"),
                    InlineKeyboardButton("Cancel", callback_data="blockchain_tx_cancel")
                ],
                [
                    InlineKeyboardButton("Refresh Price", callback_data="blockchain_gas_refresh"),
                    InlineKeyboardButton("Set Custom Gas", callback_data="blockchain_gas_custom")
                ]
            ]
            
            await query.message.edit_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        elif action == "custom":
            # Allow setting custom gas price
            await query.message.edit_text(
                "Enter custom gas price in gwei:",
                reply_markup=ForceReply(selective=True)
            )
            return AWAITING_GAS_PRICE

    async def handle_gas_price_input(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle custom gas price input."""
        try:
            gas_price = float(update.message.text.strip())
            operation = context.user_data.get("pending_operation")
            
            if not operation:
                await update.message.reply_text(
                    "No pending operation to estimate gas for."
                )
                return ConversationHandler.END
                
            # Update gas price in operation
            operation["gas_price"] = gas_price
            estimate = await self.bot.blockchain_manager.estimate_gas(
                operation=operation["type"],
                params=operation["params"],
                gas_price=gas_price
            )
            
            message = (
                "⛽ Gas Estimate (Custom Price)\n\n"
                f"Operation: {estimate.operation}\n"
                f"Gas Limit: {estimate.gas_limit:,}\n"
                f"Gas Price: {gas_price} gwei\n"
                f"Total Cost: {estimate.total_cost:.6f} ETH\n\n"
                "Would you like to proceed with the transaction?"
            )
            
            keyboard = [
                [
                    InlineKeyboardButton("Proceed", callback_data="blockchain_tx_proceed"),
                    InlineKeyboardButton("Cancel", callback_data="blockchain_tx_cancel")
                ],
                [
                    InlineKeyboardButton("Refresh Price", callback_data="blockchain_gas_refresh"),
                    InlineKeyboardButton("Set Custom Gas", callback_data="blockchain_gas_custom")
                ]
            ]
            
            await update.message.reply_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return ConversationHandler.END
            
        except ValueError:
            await update.message.reply_text(
                "Please enter a valid number for gas price (in gwei):"
            )
            return AWAITING_GAS_PRICE

    async def handle_tx_date_input(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle transaction date range input."""
        try:
            if "tx_filter" not in context.user_data:
                context.user_data["tx_filter"] = {}
            
            if "start_date" not in context.user_data["tx_filter"]:
                # Handle start date
                start_date = datetime.strptime(update.message.text.strip(), "%Y-%m-%d")
                context.user_data["tx_filter"]["start_date"] = start_date
                
                await update.message.reply_text(
                    "Please enter the end date (YYYY-MM-DD):",
                    reply_markup=ForceReply(selective=True)
                )
                return AWAITING_TX_DATES
                
            else:
                # Handle end date
                end_date = datetime.strptime(update.message.text.strip(), "%Y-%m-%d")
                start_date = context.user_data["tx_filter"]["start_date"]
                
                if end_date < start_date:
                    await update.message.reply_text(
                        "End date must be after start date. Please enter end date again (YYYY-MM-DD):"
                    )
                    return AWAITING_TX_DATES
                
                # Get filtered transactions
                transactions = await self.bot.blockchain_manager.get_transaction_history(
                    start_date=start_date,
                    end_date=end_date
                )
                
                if not transactions:
                    await update.message.reply_text(
                        "No transactions found in the specified date range.",
                        reply_markup=InlineKeyboardMarkup([[
                            InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                        ]])
                    )
                    return ConversationHandler.END
                
                message = f"📜 Transactions ({start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')})\n\n"
                
                for tx in transactions:
                    status_emoji = {
                        "success": "✅",
                        "failed": "❌",
                        "pending": "⏳"
                    }.get(tx.status, "❓")
                    
                    message += (
                        f"{status_emoji} {tx.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
                        f"Type: {tx.asset.upper()}\n"
                        f"Amount: {tx.amount}\n"
                        f"Gas Used: {tx.gas_used} @ {tx.gas_price} gwei\n"
                        f"Hash: {tx.tx_hash[:6]}...{tx.tx_hash[-4:]}\n\n"
                    )
                
                # Clear filter data
                context.user_data.pop("tx_filter")
                
                await update.message.reply_text(
                    message,
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                    ]])
                )
                return ConversationHandler.END
                
        except ValueError:
            await update.message.reply_text(
                "Please enter a valid date in YYYY-MM-DD format:"
            )
            return AWAITING_TX_DATES

    async def handle_tx_filter(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle transaction filtering by asset."""
        try:
            query = update.callback_query
            await query.answer()
            
            asset = query.data.replace("blockchain_tx_filter_", "")
            
            # Get filtered transactions
            transactions = await self.bot.blockchain_manager.get_transaction_history(
                asset=asset.upper()
            )
            
            if not transactions:
                await query.message.edit_text(
                    f"No transactions found for {asset.upper()}.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                    ]])
                )
                return
            
            message = f"📜 {asset.upper()} Transactions\n\n"
            
            for tx in transactions:
                status_emoji = {
                    "success": "✅",
                    "failed": "❌",
                    "pending": "⏳"
                }.get(tx.status, "❓")
                
                message += (
                    f"{status_emoji} {tx.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
                    f"Amount: {tx.amount}\n"
                    f"Gas Used: {tx.gas_used} @ {tx.gas_price} gwei\n"
                    f"Hash: {tx.tx_hash[:6]}...{tx.tx_hash[-4:]}\n\n"
                )
            
            keyboard = [
                [
                    InlineKeyboardButton("Export", callback_data="blockchain_tx_export"),
                    InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                ]
            ]
            
            await query.message.edit_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        except Exception as e:
            logger.error(f"Error filtering transactions: {str(e)}")
            await query.message.edit_text(
                "Sorry, there was an error filtering transactions. Please try again later.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("Back", callback_data="blockchain_tx_back")
                ]])
            )

    async def cleanup_operation(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Clean up any pending operations and user data."""
        if "pending_operation" in context.user_data:
            context.user_data.pop("pending_operation")
        if "tx_filter" in context.user_data:
            context.user_data.pop("tx_filter")
        if "swap" in context.user_data:
            context.user_data.pop("swap")
            
        await update.message.reply_text(
            "Operation cancelled. You can start over with /blockchain"
        )
        return ConversationHandler.END 