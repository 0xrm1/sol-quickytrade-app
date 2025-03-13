'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { createJupiterApiClient } from '@jup-ag/api'

// Constants
const SOLANA_RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com'
const JUPITER_API_ENDPOINT = 'https://quote-api.jup.ag/v6'

// USDC token mint address
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function Module5() {
  // State for form inputs
  const [privateKey, setPrivateKey] = useState('')
  const [tokenMint, setTokenMint] = useState(USDC_MINT) // Default to USDC
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('1')
  const [priorityFee, setPriorityFee] = useState('5')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [txSignature, setTxSignature] = useState('')

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
      
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0')
      }
      
      if (!slippage || parseFloat(slippage) < 0.1) {
        throw new Error('Slippage must be at least 0.1%')
      }
      
      if (!priorityFee || parseInt(priorityFee) < 0) {
        throw new Error('Priority fee must be at least 0')
      }

      try {
        // Create connection to Solana
        const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed')
        
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
        
        // Convert SOL to lamports
        const amountInLamports = Math.floor(parseFloat(amount) * 10**9)
        
        // Get quote for swap
        console.log('Getting quote...')
        const quoteResponse = await jupiterClient.quoteGet({
          inputMint: 'So11111111111111111111111111111111111111112', // SOL mint address
          outputMint: tokenMint,
          amount: amountInLamports, // Amount in lamports
          slippageBps: parseInt(slippage) * 100, // Convert percentage to basis points
          onlyDirectRoutes: false,
          restrictIntermediateTokens: true, // Restrict to highly liquid tokens for better success rate
        })
        
        console.log('Quote received:', {
          inAmount: quoteResponse.inAmount,
          outAmount: quoteResponse.outAmount,
          otherAmountThreshold: quoteResponse.otherAmountThreshold,
        })
        
        // Get serialized transactions
        console.log('Creating swap transaction...')
        const swapResponse = await jupiterClient.swapPost({
          swapRequest: {
            quoteResponse,
            userPublicKey: walletPublicKey.toString(),
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                maxLamports: parseInt(priorityFee) * 1000, // Convert MICRO-SOL to lamports
                priorityLevel: "high"
              }
            }
          }
        })
        
        console.log('Swap transaction created')
        
        // Process and sign transaction
        const { swapTransaction } = swapResponse
        
        try {
          // Deserialize transaction
          let transaction
          const transactionBuffer = Buffer.from(swapTransaction.replace(/^0x/, ''), 'hex')
          
          if (swapTransaction.startsWith('0x01')) {
            // Versioned transaction
            transaction = VersionedTransaction.deserialize(transactionBuffer)
            
            // Sign the transaction
            transaction.sign([keypair])
          } else {
            // Legacy transaction
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
          setSuccess(`Swap executed successfully! Transaction signature: ${signature}`)
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
          
          {/* Amount Input */}
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
          
          {/* Buy Button */}
          <Button 
            className="w-full" 
            onClick={handleSwap}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Buy Token'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default Module5 