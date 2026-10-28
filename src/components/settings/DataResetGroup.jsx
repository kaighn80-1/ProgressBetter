import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function DataResetGroup({ group, counts, selected, onToggle }) {
  const total = group.entities.reduce((sum, e) => sum + (counts[e.name] || 0), 0);

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">{group.title}</h3>
            <p className="text-sm text-slate-500">{group.description}</p>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">
            {total}
          </Badge>
        </div>

        <div className="mt-3 space-y-2">
          {group.entities.map((entity) => {
            const isOn = selected.includes(entity.name);
            return (
              <label
                key={entity.name}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100"
              >
                <span className="flex items-center gap-2">
                  <Checkbox checked={isOn} onCheckedChange={() => onToggle(entity.name)} />
                  <span className="text-sm text-slate-700">{entity.label}</span>
                </span>
                <span className="text-sm font-medium text-slate-500">
                  {counts[entity.name] ?? 0}
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}