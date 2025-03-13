'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function Module3() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Module 3</CardTitle>
        <CardDescription>This module will be implemented in future updates.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-md">
          <p className="text-gray-500 dark:text-gray-400">Coming soon</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default Module3 