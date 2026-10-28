import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AlertTriangle, Database, Loader2, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import DataResetGroup from '@/components/settings/DataResetGroup';

const GROUPS = [
  {
    title: 'Inventory & Materials',
    description: 'Parts, fixings, bar profiles, billets and cut history.',
    entities: [
      { name: 'Part', label: 'Parts (master data)' },
      { name: 'Fixing', label: 'Fixings & consumables' },
      { name: 'BarStock', label: 'Bar stock profiles' },
      { name: 'BarBillet', label: 'Bar billets' },
      { name: 'BarCutLog', label: 'Bar cut logs' }
    ]
  },
  {
    title: 'Production Records',
    description: 'Work in progress batches and all stock movement history.',
    entities: [
      { name: 'WorkInProgress', label: 'Work in progress' },
      { name: 'StockTransaction', label: 'Stock transactions' }
    ]
  },
  {
    title: 'Projects & Assemblies',
    description: 'Projects, sections, sub-sections, requirements and bills of materials.',
    entities: [
      { name: 'Project', label: 'Projects' },
      { name: 'Section', label: 'Sections' },
      { name: 'Subsection', label: 'Sub-sections' },
      { name: 'PartRequirement', label: 'Part requirements' },
      { name: 'Assembly', label: 'Assemblies' }
    ]
  },
  {
    title: 'Delivery',
    description: 'Delivery notes and saved delivery addresses.',
    entities: [
      { name: 'DeliveryNote', label: 'Delivery notes' },
      { name: 'DeliveryAddress', label: 'Delivery addresses' }
    ]
  },
  {
    title: 'Workflow Stages',
    description: 'The operation stages parts move through. Keep these to stay usable out of the box.',
    entities: [{ name: 'Operation', label: 'Operations' }]
  }
];

const DELETE_ORDER = [
  'BarCutLog',
  'BarBillet',
  'StockTransaction',
  'WorkInProgress',
  'DeliveryNote',
  'DeliveryAddress',
  'Assembly',
  'PartRequirement',
  'Part',
  'Subsection',
  'Section',
  'Project',
  'BarStock',
  'Fixing',
  'Operation'
];

const STARTER_OPERATIONS = [
  { operation_name: 'Cutting', sequence_number: 10, description: 'Cut blanks from bar or sheet', is_final: false },
  { operation_name: 'Forming', sequence_number: 20, description: 'Bend, fold and shape', is_final: false },
  { operation_name: 'Welding', sequence_number: 30, description: 'Weld and fabricate', is_final: false },
  { operation_name: 'Finishing', sequence_number: 40, description: 'Paint, powder coat or polish', is_final: false },
  { operation_name: 'Assembly', sequence_number: 50, description: 'Assemble into finished product', is_final: false },
  { operation_name: 'Quality Check', sequence_number: 60, description: 'Final inspection', is_final: true }
];

export default function DataReset() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState('');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const entries = await Promise.all(
        GROUPS.flatMap((g) => g.entities).map(async (entity) => [
          entity.name,
          await base44.entities[entity.name].count({})
        ])
      );
      setCounts(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntity = (name) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const allNames = GROUPS.flatMap((g) => g.entities.map((e) => e.name));
  const totalSelected = allNames
    .filter((n) => selected.includes(n))
    .reduce((sum, n) => sum + (counts[n] || 0), 0);

  const eraseData = async () => {
    setWorking(true);
    try {
      const ordered = DELETE_ORDER.filter((n) => selected.includes(n));
      for (const name of ordered) {
        setProgress(GROUPS.flatMap((g) => g.entities).find((e) => e.name === name)?.label || name);
        await base44.entities[name].deleteMany({});
      }
      toast.success('Selected data erased — this copy is now blank');
      setSelected([]);
      setConfirmText('');
      setShowConfirm(false);
      await loadCounts();
    } catch (e) {
      console.error(e);
      toast.error('Something went wrong while erasing. Check what is left and try again.');
    } finally {
      setWorking(false);
      setProgress('');
    }
  };

  const addStarterOperations = async () => {
    setSeeding(true);
    try {
      await base44.entities.Operation.bulkCreate(STARTER_OPERATIONS);
      toast.success('Starter workflow stages added');
      await loadCounts();
    } catch (e) {
      console.error(e);
      toast.error('Failed to add starter operations');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center">
          <ShieldAlert className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">Managers only</h3>
          <p className="text-sm text-slate-500">
            Data reset is restricted to admins. Ask a manager to blank this copy.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Blank Copy / Data Reset</h1>
        <p className="text-sm text-slate-500">
          Strip out your company data to hand this over as a fresh, empty system.
        </p>
      </div>

      <Alert className="bg-red-50 border-red-200">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertTitle className="text-red-900">Permanent and cannot be undone</AlertTitle>
        <AlertDescription className="text-red-800">
          Everything ticked below is deleted for good. All app features, pages, workflows and settings stay
          exactly as they are. Take a backup of anything you may need first.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelected(allNames)}>
          Select everything
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSelected([])}>
          Clear selection
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <DataResetGroup
            key={group.title}
            group={group}
            counts={counts}
            selected={selected}
            onToggle={toggleEntity}
          />
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">
              {selected.length} group{selected.length === 1 ? '' : 's'} selected
            </p>
            <p className="text-sm text-slate-500">{totalSelected} records will be deleted</p>
          </div>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={selected.length === 0 || working}
            onClick={() => setShowConfirm(true)}
          >
            {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Erase selected data
          </Button>
        </CardContent>
      </Card>

      {(counts.Operation || 0) === 0 && (
        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-blue-900">No operations defined yet</p>
              <p className="text-sm text-blue-700">
                Parts need workflow stages before they can be scanned into production.
              </p>
            </div>
            <Button variant="outline" onClick={addStarterOperations} disabled={seeding}>
              {seeding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Add starter stages
            </Button>
          </CardContent>
        </Card>
      )}

      {working && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-slate-600">
              Erasing {progress}…
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-md bg-slate-50">
        <CardContent className="p-4 flex gap-3">
          <Database className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-800">How to hand a clean copy out</p>
            <p>
              Clone this app from the Apps menu — the clone carries all code, pages and logic but no data.
              Reset the clone here if anything is left behind, then share it with the company.
            </p>
            <p>Team logins are never copied, so each company invites its own staff.</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={showConfirm}
        onOpenChange={(open) => {
          setShowConfirm(open);
          if (!open) setConfirmText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase {totalSelected} records?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the selected data permanently. Type ERASE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Type ERASE</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ERASE"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={confirmText !== 'ERASE' || working}
              onClick={eraseData}
            >
              Erase permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}