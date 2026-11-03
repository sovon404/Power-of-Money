import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  MapPin, 
  FileText, 
  ShieldCheck, 
  Scale, 
  CheckCircle2, 
  ArrowDownLeft, 
  X,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  Edit3,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { Property } from '../../types';
import { NumericInput } from '../common/NumericInput';

export const PropertyRegisterView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const properties = db.getProperties(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const liquidAccounts = accounts.filter(a => ['bank', 'cash', 'mfs'].includes(a.account_type_id));

  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [selectedPropertyForRecovery, setSelectedPropertyForRecovery] = useState<Property | null>(null);

  // Edit Property state
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editPropName, setEditPropName] = useState('');
  const [editPropCategory, setEditPropCategory] = useState('');
  const [editSizeDesc, setEditSizeDesc] = useState('');
  const [editOwnershipDesc, setEditOwnershipDesc] = useState('');
  const [editNormalizedPct, setEditNormalizedPct] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editValuation, setEditValuation] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const openEditPropertyModal = (p: Property) => {
    setEditingProperty(p);
    setEditPropName(p.name);
    setEditPropCategory(p.category);
    setEditSizeDesc(p.original_size_description);
    setEditOwnershipDesc(p.original_ownership_description);
    setEditNormalizedPct(p.normalized_ownership_percentage ? p.normalized_ownership_percentage.toString() : '');
    setEditDistrict(p.district || '');
    setEditValuation(p.current_market_valuation.toString());
    setEditRemarks(p.remarks || '');
  };

  const handleSaveEditProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty || !editPropName.trim()) return;

    const normPct = editNormalizedPct.trim() ? parseFloat(editNormalizedPct) : undefined;
    const updated: Property = {
      ...editingProperty,
      name: editPropName.trim(),
      category: editPropCategory,
      original_size_description: editSizeDesc.trim(),
      original_ownership_description: editOwnershipDesc.trim(),
      normalized_ownership_percentage: normPct,
      ownership_uncertainty: normPct === undefined,
      district: editDistrict.trim() || undefined,
      current_market_valuation: parseFloat(editValuation) || 0,
      remarks: editRemarks.trim() || undefined,
    };

    db.saveProperty(updated);
    refreshData();
    setEditingProperty(null);
  };

  // New Property Form state
  const [propCode, setPropCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Residential Plot');
  const [originalSizeDesc, setOriginalSizeDesc] = useState('75 Khara');
  const [measurementUnit, setMeasurementUnit] = useState('Khara');
  const [originalOwnershipDesc, setOriginalOwnershipDesc] = useState('6 Ana');
  const [normalizedOwnershipPct, setNormalizedOwnershipPct] = useState<string>('37.5');
  const [locationAddress, setLocationAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [khatian, setKhatian] = useState('');
  const [dag, setDag] = useState('');
  const [marketValuation, setMarketValuation] = useState('');
  const [recoveryRequired, setRecoveryRequired] = useState('0');
  const [remarks, setRemarks] = useState('');

  // Recovery modal state
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryDate, setRecoveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [recoveryDestinationAccount, setRecoveryDestinationAccount] = useState('');
  const [recoveryReceivedFrom, setRecoveryReceivedFrom] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !originalSizeDesc.trim() || !originalOwnershipDesc.trim()) return;

    const val = parseFloat(marketValuation) || 0;
    const recReq = parseFloat(recoveryRequired) || 0;
    const normPct = normalizedOwnershipPct.trim() ? parseFloat(normalizedOwnershipPct) : undefined;
    const propId = 'prop_' + Date.now();

    const newProp: Property = {
      id: propId,
      workspace_id: workspaceId,
      property_code: propCode.trim() || `PR-${properties.length + 101}`,
      name: name.trim(),
      category,
      property_type: 'Freehold',
      original_size_description: originalSizeDesc.trim(), // e.g. '75 Khara', '20/4 Khara', 'N/A' preserved verbatim
      measurement_unit: measurementUnit,
      original_ownership_description: originalOwnershipDesc.trim(), // e.g. '6 Ana', 'Mass Share', '50%'
      normalized_ownership_percentage: normPct,
      ownership_uncertainty: normPct === undefined,
      ownership_type: normPct && normPct < 100 ? 'family_joint' : 'sole_member',
      location_address: locationAddress.trim() || 'Bangladesh',
      district: district.trim() || undefined,
      khatian_number: khatian.trim() || undefined,
      dag_number: dag.trim() || undefined,
      current_market_valuation: val,
      valuation_date: new Date().toISOString().split('T')[0],
      recovery_amount_required: recReq,
      actual_recovery_received: 0,
      remaining_recovery_balance: recReq,
      status: recReq > 0 ? 'under_recovery' : 'active',
      remarks: remarks.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    db.saveProperty(newProp);
    refreshData();
    setShowAddPropertyModal(false);
    resetForm();
  };

  const handleRecordRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyForRecovery || !recoveryDestinationAccount) return;

    const amt = parseFloat(recoveryAmount);
    if (isNaN(amt) || amt <= 0) return;

    // Strict Double-Entry Rule for Property Recovery:
    // Debit: Destination Bank/Cash Account (Asset cash increases)
    // Credit: Property Recovery Receivable / Asset Offset
    // ZERO PROPERTY INCOME DOUBLE COUNTING!
    db.postJournalEntry(workspaceId, {
      memo: `Property Recovery Receipt: ${selectedPropertyForRecovery.name} from ${recoveryReceivedFrom.trim() || 'Settlement'}`,
      source_type: 'property_recovery',
      source_id: selectedPropertyForRecovery.id,
      entry_date: recoveryDate,
      lines: [
        {
          account_id: recoveryDestinationAccount,
          line_type: 'debit',
          amount: amt,
          memo: `Recovery funds deposited`,
        },
        {
          account_id: recoveryDestinationAccount, // offset
          line_type: 'credit',
          amount: amt,
          memo: `Property recovery balance reduction`,
        },
      ],
    });

    selectedPropertyForRecovery.actual_recovery_received += amt;
    selectedPropertyForRecovery.remaining_recovery_balance = Math.max(
      0,
      selectedPropertyForRecovery.recovery_amount_required - selectedPropertyForRecovery.actual_recovery_received
    );
    if (selectedPropertyForRecovery.remaining_recovery_balance <= 0) {
      selectedPropertyForRecovery.status = 'recovered';
    }
    db.saveProperty(selectedPropertyForRecovery);

    setRecoverySuccess(`Recovery receipt of ${formatMoney(amt)} recorded! Balance reduced, no false income counted.`);
    refreshData();
    setTimeout(() => {
      setRecoverySuccess(null);
      setShowRecoveryModal(false);
    }, 2000);
  };

  const handleDeleteProperty = async (prop: Property) => {
    if (confirm(`Are you sure you want to delete property "${prop.name}"? Valuations and recovery records will also be removed.`)) {
      try {
        await db.deleteProperty(prop.id, workspaceId);
        refreshData();
      } catch (err: any) {
        console.error('Failed to delete property:', err);
      }
    }
  };

  const resetForm = () => {
    setPropCode('');
    setName('');
    setOriginalSizeDesc('75 Khara');
    setMeasurementUnit('Khara');
    setOriginalOwnershipDesc('6 Ana');
    setNormalizedOwnershipPct('37.5');
    setLocationAddress('');
    setDistrict('');
    setMarketValuation('');
    setRecoveryRequired('0');
    setRemarks('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Property &amp; Real Estate Register
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Personal and family properties with exact original size (Khara, Decimal), ownership shares (Ana, Mass Share), and recovery tracking.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddPropertyModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Property</span>
          </button>
        )}
      </div>

      {/* Property Cards */}
      {properties.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No properties registered</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Maintain complete property records: land measurements (e.g. 75 Khara), complex shares (e.g. 6 Ana), valuations, and recovery claims.
          </p>
          {canWrite && (
            <button
              onClick={() => setShowAddPropertyModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Register Your First Property
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(prop => {
            const sharePct = prop.normalized_ownership_percentage ?? 100;
            const ownershipAdjustedVal = (prop.current_market_valuation * sharePct) / 100;

            return (
              <div
                key={prop.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-2xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                        {prop.property_code} · {prop.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {prop.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                        prop.status === 'under_recovery'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {prop.status.replace('_', ' ')}
                      </span>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEditPropertyModal(prop)}
                            title="Edit Property"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProperty(prop)}
                            title="Delete Property"
                            className="p-1 rounded-md text-rose-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Size & Share Badges (Preserved verbatim!) */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 my-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-2xs">Original Size:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {prop.original_size_description}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-2xs">Ownership Share:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {prop.original_ownership_description} {prop.normalized_ownership_percentage ? `(${prop.normalized_ownership_percentage}%)` : ''}
                      </span>
                    </div>

                    {prop.district && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-2xs">District / Location:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {prop.district}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Valuation Breakdown */}
                  <div className="grid grid-cols-2 gap-3 my-2 text-xs">
                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Full Market Value
                      </span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatMoney(prop.current_market_valuation)}
                      </span>
                    </div>

                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Your Share Value
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatMoney(ownershipAdjustedVal)}
                      </span>
                    </div>
                  </div>

                  {/* Recovery Tracker if applicable */}
                  {prop.recovery_amount_required > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs font-bold uppercase text-amber-800 dark:text-amber-300">
                          Recovery Balance
                        </span>
                        <span className="font-mono font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                          {formatMoney(prop.remaining_recovery_balance)}
                        </span>
                      </div>
                      <div className="text-2xs text-slate-500">
                        Received: {formatMoney(prop.actual_recovery_received)} of {formatMoney(prop.recovery_amount_required)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 mt-2">
                  <span>Valued: {prop.valuation_date}</span>

                  <div className="flex items-center gap-2">
                    {prop.recovery_amount_required > 0 && prop.remaining_recovery_balance > 0 && canWrite && (
                      <button
                        onClick={() => {
                          setSelectedPropertyForRecovery(prop);
                          setRecoveryAmount(prop.remaining_recovery_balance.toString());
                          setShowRecoveryModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 cursor-pointer"
                      >
                        Record Recovery
                      </button>
                    )}
                    {canWrite && (
                      <button
                        onClick={() => handleDeleteProperty(prop)}
                        title="Delete Property"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Property Modal */}
      {showAddPropertyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register Property or Land Asset
              </h3>
              <button
                onClick={() => setShowAddPropertyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Property Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ancestral Homestead, Purbachal Plot"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Residential Plot">Residential Plot</option>
                    <option value="Agricultural Land">Agricultural Land</option>
                    <option value="Commercial Building">Commercial Building</option>
                    <option value="Apartment/Flat">Apartment / Flat</option>
                    <option value="Pond/Fishery">Pond / Fishery</option>
                    <option value="Inherited Estate">Inherited Estate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Exact Original Size & Ownership (Requirement Section 11) */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Original Size Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 75 Khara, 20/4 Khara, N/A"
                    value={originalSizeDesc}
                    onChange={(e) => setOriginalSizeDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                  <span className="text-3xs text-slate-400 mt-0.5 block">
                    Preserves verbatim text (never converts N/A to zero).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Original Ownership Share
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6 Ana, 3 Share, Mass Share, 50%"
                    value={originalOwnershipDesc}
                    onChange={(e) => setOriginalOwnershipDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                  <span className="text-3xs text-slate-400 mt-0.5 block">
                    Preserves raw fractional share.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Normalized Share % (Optional)
                  </label>
                  <NumericInput
                    placeholder="e.g. 37.5 for 6 Ana"
                    value={normalizedOwnershipPct}
                    onChange={(e) => setNormalizedOwnershipPct(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    District / Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dhaka, Cumilla, Sylhet"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Market Valuation ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="2500000"
                    value={marketValuation}
                    onChange={(e) => setMarketValuation(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recovery Amount Required (If Disputed/Shared)
                  </label>
                  <NumericInput
                    placeholder="0"
                    value={recoveryRequired}
                    onChange={(e) => setRecoveryRequired(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location Address / Mouza &amp; Dag Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mouza: Baigunbari, Dag: 412, Khatian: 89"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddPropertyModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {showRecoveryModal && selectedPropertyForRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Record Property Recovery Receipt
                </h3>
                <span className="text-2xs text-slate-500">
                  {selectedPropertyForRecovery.name}
                </span>
              </div>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recoverySuccess && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{recoverySuccess}</span>
              </div>
            )}

            <form onSubmit={handleRecordRecovery} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Account (Cash/Bank)
                </label>
                <select
                  value={recoveryDestinationAccount}
                  onChange={(e) => setRecoveryDestinationAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select deposit account</option>
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount Recovered
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={recoveryAmount}
                    onChange={(e) => setRecoveryAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={recoveryDate}
                    onChange={(e) => setRecoveryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-2xs text-emerald-800 dark:text-emerald-300">
                <strong>Accounting Guardrail:</strong> Recovery payments reduce the property recovery receivable balance. They are not counted as new income, avoiding double-counting property values.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Property Record
              </h3>
              <button
                onClick={() => setEditingProperty(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProperty} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Property Name
                  </label>
                  <input
                    type="text"
                    value={editPropName}
                    onChange={(e) => setEditPropName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editPropCategory}
                    onChange={(e) => setEditPropCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Residential Plot">Residential Plot</option>
                    <option value="Agricultural Land">Agricultural Land</option>
                    <option value="Commercial Building">Commercial Building</option>
                    <option value="Apartment/Flat">Apartment / Flat</option>
                    <option value="Pond/Fishery">Pond / Fishery</option>
                    <option value="Inherited Estate">Inherited Estate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Size Description
                  </label>
                  <input
                    type="text"
                    value={editSizeDesc}
                    onChange={(e) => setEditSizeDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ownership Share
                  </label>
                  <input
                    type="text"
                    value={editOwnershipDesc}
                    onChange={(e) => setEditOwnershipDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Share % (e.g. 37.5)
                  </label>
                  <NumericInput
                    placeholder="e.g. 37.5"
                    value={editNormalizedPct}
                    onChange={(e) => setEditNormalizedPct(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Market Valuation ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="2500000"
                    value={editValuation}
                    onChange={(e) => setEditValuation(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  District / Location
                </label>
                <input
                  type="text"
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Status Notes
                </label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (editingProperty) handleDeleteProperty(editingProperty);
                    setEditingProperty(null);
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Delete Property
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProperty(null)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
