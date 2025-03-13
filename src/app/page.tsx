import Module1 from '@/components/modules/Module1'
import Module2 from '@/components/modules/Module2'
import Module3 from '@/components/modules/Module3'
import Module4 from '@/components/modules/Module4'
import Module5 from '@/components/modules/Module5'

export default function Home() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Sol QuickyTrade</h1>
        <p className="text-gray-600 dark:text-gray-400">Fast and optimized Solana token swaps</p>
      </header>
      
      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Module1 />
          </div>
          <div className="lg:col-span-1">
            <Module2 />
          </div>
          <div className="lg:col-span-1">
            <Module3 />
          </div>
          <div className="lg:col-span-1">
            <Module4 />
          </div>
          <div className="lg:col-span-2">
            <Module5 />
          </div>
        </div>
      </main>
      
      <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Sol QuickyTrade. All rights reserved.</p>
      </footer>
    </div>
  );
}
