'use client'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

// Valve Results Types
interface ValveCounts {
  total_detections: number;
  ball_valve_vb: number;
  check_valve_vc: number;
  gate_valve_vg: number;
  globe_valve_vgl: number;
  pcv: number;
  tcv: number;
  bdv: number;
  sdv: number;
  fcv: number;
  psv: number;
  lcv: number;
}

interface ValveResultsProps {
  valveCounts: ValveCounts;
}

export default function ValveResults({ valveCounts }: ValveResultsProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
          Valve Detection Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {valveCounts.total_detections}
            </div>
            <div className="text-sm text-muted-foreground">Total Valves</div>
          </div>
          
          {Object.entries(valveCounts)
            .filter(([key]) => key !== 'total_detections')
            .map(([key, value]) => (
              <div key={key} className="text-center p-3 bg-muted/50 rounded-lg border">
                <div className="text-xl font-semibold">{value}</div>
                <div className="text-xs text-muted-foreground uppercase">
                  {key.replace('_', ' ').replace('valve', '').trim()}
                </div>
              </div>
            ))
          }
        </div>
      </CardContent>
    </Card>
  );
}