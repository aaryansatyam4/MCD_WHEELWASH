import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface HourlyDataPoint {
  hour: string;
  ghazipur: number;
  okhla: number;
  bhalaswa: number;
  total: number;
}

interface HourlyChartProps {
  data: HourlyDataPoint[];
  title?: string;
  singleLocationName?: string;
}

export const HourlyChart: React.FC<HourlyChartProps> = ({
  data,
  title = "Today's Hourly Truck Movement",
  singleLocationName,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">24-Hour passage distribution (Asia/Kolkata)</p>
        </div>
        <div className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
          Peak Movement Tracker
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tick={{ fill: '#64748B', fontSize: 11 }}
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tick={{ fill: '#64748B', fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                borderColor: '#1E293B',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelStyle={{ fontWeight: 'bold', color: '#94A3B8', marginBottom: '4px' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
              iconType="circle"
            />

            {singleLocationName ? (
              <Bar
                dataKey="total"
                name={singleLocationName}
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            ) : (
              <>
                <Bar
                  dataKey="ghazipur"
                  name="Ghazipur"
                  fill="#3B82F6"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="okhla"
                  name="Okhla"
                  fill="#10B981"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="bhalaswa"
                  name="Bhalaswa"
                  fill="#F59E0B"
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
