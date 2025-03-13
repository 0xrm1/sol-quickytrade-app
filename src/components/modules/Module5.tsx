'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Connection, Keypair, Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { createJupiterApiClient } from '@jup-ag/api'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Constants
const SOLANA_RPC_ENDPOINT = 'https://nd-220-380-828.p2pify.com/860578b990cf2dfee6f98b15852612cf'
const SOLANA_WS_ENDPOINT = 'wss://ws-nd-220-380-828.p2pify.com/860578b990cf2dfee6f98b15852612cf'
const JUPITER_API_ENDPOINT = 'https://quote-api.jup.ag/v6'
// Platform fee settings
const PLATFORM_FEE_BPS = 100 // 1% fee in basis points (100 bps = 1%)
// Jupiter Referral Key
const REFERRAL_KEY = 'FrSZiQdctfgzZzV8PTGnWvRxCRzA2oBXqBHK6faMXwTK'

// USDC token mint address
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
// SOL token mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112'

// This module handles automatic swap transactions with Jupiter API
function Module5() {
  // State for form inputs
  const [privateKey, setPrivateKey] = useState('')
  const [tokenMint, setTokenMint] = useState(USDC_MINT) // Default to USDC
  const [amount, setAmount] = useState('')
  const [sellPercentage, setSellPercentage] = useState('100') // Default to 100%
  const [slippage, setSlippage] = useState('1')
  const [priorityFee, setPriorityFee] = useState('5')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const [isBuying, setIsBuying] = useState(true) // true for buying, false for selling

  // Handle swap transaction
  const handleSwap = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')
    setTxSignature('')

    try {
      // Validate inputs
      if (!privateKey) {
        throw new Error('Private key is required')
      }
      
      if (!tokenMint) {
        throw new Error('Token mint address is required')
      }
      
      if (isBuying && (!amount || parseFloat(amount) <= 0)) {
        throw new Error('Amount must be greater than 0')
      }
      
      if (!isBuying && (!sellPercentage || parseFloat(sellPercentage) <= 0 || parseFloat(sellPercentage) > 100)) {
        throw new Error('Sell percentage must be between 1 and 100')
      }
      
      if (!slippage || parseFloat(slippage) < 0.1) {
        throw new Error('Slippage must be at least 0.1%')
      }
      
      if (!priorityFee || parseInt(priorityFee) < 0) {
        throw new Error('Priority fee must be at least 0')
      }

      try {
        // Create connection to Solana with both HTTP and WebSocket endpoints
        const connection = new Connection(
          SOLANA_RPC_ENDPOINT, 
          { wsEndpoint: SOLANA_WS_ENDPOINT, commitment: 'confirmed' }
        )
        
        // Decode private key and create keypair
        const decodedPrivateKey = bs58.decode(privateKey)
        
        // Create keypair from private key
        const keypair = Keypair.fromSecretKey(decodedPrivateKey)
        
        // Get wallet public key
        const walletPublicKey = keypair.publicKey
        
        // Initialize Jupiter API client
        const jupiterClient = createJupiterApiClient({
          basePath: JUPITER_API_ENDPOINT
        })

        // Determine input and output mints based on buy/sell mode
        const inputMint = isBuying ? SOL_MINT : tokenMint
        const outputMint = isBuying ? tokenMint : SOL_MINT

        let amountInLamports

        if (isBuying) {
          // Convert SOL to lamports for buying
          amountInLamports = Math.floor(parseFloat(amount) * 10**9)
        } else {
          // For selling, we need to get the token balance first
          const tokenMintPubkey = new PublicKey(tokenMint)
          
          // Find the associated token account
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { mint: tokenMintPubkey }
          )
          
          if (tokenAccounts.value.length === 0) {
            throw new Error(`No token account found for ${tokenMint}`)
          }
          
          // Get the token balance
          const tokenAccount = tokenAccounts.value[0]
          const tokenBalance = tokenAccount.account.data.parsed.info.tokenAmount.amount
          
          if (parseInt(tokenBalance) === 0) {
            throw new Error(`You don't have any tokens to sell for ${tokenMint}`)
          }
          
          // Calculate the amount to sell based on percentage
          const sellRatio = parseFloat(sellPercentage) / 100
          amountInLamports = Math.floor(parseInt(tokenBalance) * sellRatio)
          
          console.log(`Selling ${sellRatio * 100}% of ${tokenBalance} tokens = ${amountInLamports} lamports`)
        }
        
        // Get quote for swap with platform fee
        console.log('Getting quote...')
        
        // Create URL for quote with referral key
        const quoteUrl = new URL(`${JUPITER_API_ENDPOINT}/quote`)
        quoteUrl.searchParams.append('inputMint', inputMint)
        quoteUrl.searchParams.append('outputMint', outputMint)
        quoteUrl.searchParams.append('amount', amountInLamports.toString())
        quoteUrl.searchParams.append('slippageBps', (parseInt(slippage) * 100).toString())
        quoteUrl.searchParams.append('platformFeeBps', PLATFORM_FEE_BPS.toString())
        
        // Get quote using URL with referral key
        const quoteResponse = await fetch(quoteUrl.toString()).then(res => res.json())
        
        console.log('Quote received:', {
          inAmount: quoteResponse.inAmount,
          outAmount: quoteResponse.outAmount,
          otherAmountThreshold: quoteResponse.otherAmountThreshold,
          platformFee: quoteResponse.platformFee
        })
        
        // Get serialized transactions
        console.log('Creating swap transaction...')
        
        // Create swap request with referral key
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const swapRequest: any = {
          quoteResponse,
          userPublicKey: walletPublicKey.toString(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: parseInt(priorityFee) * 1000, // Convert MICRO-SOL to lamports
              priorityLevel: "high"
            }
          },
          // Add referral key to swap request
          referralKey: REFERRAL_KEY
        }
        
        // We don't need to specify feeAccount anymore as the referral program handles it
        // The referral program will automatically route fees to the appropriate token accounts
        
        const swapResponse = await jupiterClient.swapPost({
          swapRequest
        })
        
        console.log('Swap transaction created')
        
        // Process and sign transaction
        const { swapTransaction } = swapResponse
        
        try {
          // Deserialize transaction - Jupiter API returns base64 encoded transaction
          let transaction
          
          // Convert base64 to buffer
          const transactionBuffer = Buffer.from(swapTransaction, 'base64')
          
          try {
            // Try to deserialize as a versioned transaction first
            transaction = VersionedTransaction.deserialize(transactionBuffer)
            console.log('Deserialized as VersionedTransaction')
            
            // Sign the transaction
            transaction.sign([keypair])
          } catch {
            // If that fails, try as a legacy transaction
            console.log('Not a VersionedTransaction, trying Legacy Transaction')
            transaction = Transaction.from(transactionBuffer)
            
            // Sign the transaction
            transaction.partialSign(keypair)
          }
          
          console.log('Transaction signed, sending to network...')
          
          // Send the transaction to the network
          const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false, maxRetries: 3 }
          )
          
          console.log('Transaction sent:', signature)
          setTxSignature(signature)
          
          // Wait for confirmation
          console.log('Waiting for confirmation...')
          const confirmation = await connection.confirmTransaction(signature, 'confirmed')
          
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`)
          }
          
          console.log('Transaction confirmed!')
          const action = isBuying ? 'bought' : 'sold'
          setSuccess(`Successfully ${action} tokens! Transaction signature: ${signature}`)
        } catch (txError) {
          console.error('Transaction error:', txError)
          setError(`Transaction error: ${txError instanceof Error ? txError.message : 'Unknown error'}`)
        }
      } catch (apiError: unknown) {
        console.error('API error:', apiError)
        setError(apiError instanceof Error ? 
          `API error: ${apiError.message}` : 
          'An error occurred while communicating with Jupiter API')
      }
    } catch (err: unknown) {
      console.error('Swap error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during the swap process')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Quick Swap</CardTitle>
        <CardDescription>Swap SOL for any Solana token quickly and efficiently</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="buy-sell-mode" 
              checked={isBuying}
              onCheckedChange={setIsBuying}
            />
            <Label htmlFor="buy-sell-mode">
              {isBuying ? 'Buy Mode' : 'Sell Mode'}
            </Label>
          </div>
          
          {/* Private Key Input */}
          <div className="space-y-2">
            <label htmlFor="privateKey" className="text-sm font-medium">
              Private Key
            </label>
            <Input
              id="privateKey"
              type="password"
              placeholder="Enter your private key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
            <p className="text-xs text-gray-500">Your key is never stored or sent to our servers</p>
          </div>
          
          {/* Token Mint Address */}
          <div className="space-y-2">
            <label htmlFor="tokenMint" className="text-sm font-medium">
              Token Mint Address
            </label>
            <Input
              id="tokenMint"
              placeholder="Enter token mint address"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
            />
            <p className="text-xs text-gray-500">Default is USDC mint address</p>
          </div>
          
          {/* Amount Input (Buy Mode) */}
          {isBuying && (
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount (SOL)
              </label>
              <Input
                id="amount"
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
          
          {/* Sell Percentage Input (Sell Mode) */}
          {!isBuying && (
            <div className="space-y-2">
              <label htmlFor="sellPercentage" className="text-sm font-medium">
                Sell Percentage (%)
              </label>
              <Input
                id="sellPercentage"
                type="number"
                placeholder="100"
                value={sellPercentage}
                onChange={(e) => setSellPercentage(e.target.value)}
                min="1"
                max="100"
              />
              <p className="text-xs text-gray-500">Enter 100 to sell all tokens</p>
            </div>
          )}
          
          {/* Slippage Input */}
          <div className="space-y-2">
            <label htmlFor="slippage" className="text-sm font-medium">
              Slippage Tolerance (%)
            </label>
            <Input
              id="slippage"
              type="number"
              placeholder="1"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>
          
          {/* Priority Fee Input */}
          <div className="space-y-2">
            <label htmlFor="priorityFee" className="text-sm font-medium">
              Priority Fee (micro-SOL)
            </label>
            <Input
              id="priorityFee"
              type="number"
              placeholder="5"
              value={priorityFee}
              onChange={(e) => setPriorityFee(e.target.value)}
            />
          </div>
          
          {/* Platform Fee Info */}
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="text-xs text-gray-500">
              A 1% platform fee is applied to all transactions. This fee is collected through Jupiter&apos;s referral program.
            </p>
          </div>
          
          {/* Error and Success Messages */}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && (
            <div className="text-sm text-green-500 space-y-1">
              <p>{success}</p>
              {txSignature && (
                <a 
                  href={`https://solscan.io/tx/${txSignature}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View on Solscan
                </a>
              )}
            </div>
          )}
          
          {/* Action Button */}
          <Button 
            className="w-full" 
            onClick={handleSwap}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : isBuying ? 'Buy Token' : 'Sell Token'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default Module5 