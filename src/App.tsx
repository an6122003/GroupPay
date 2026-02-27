import React, { useState, useEffect } from 'react';
import { Member, MonthlyBill, MemberPayment } from './types';
import { format, getMonth, getYear, subMonths, addMonths } from 'date-fns';
import { CheckCircle2, Upload, UserPlus, Image as ImageIcon, X, Receipt, DollarSign, Trash2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [bill, setBill] = useState<MonthlyBill | null>(null);
  
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  // Delete Member Modal
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  // Bill Modal
  const [isSettingBill, setIsSettingBill] = useState(false);
  const [billPayerId, setBillPayerId] = useState('');
  const [billTotalAmount, setBillTotalAmount] = useState('');
  const [billReceiptFile, setBillReceiptFile] = useState<File | null>(null);

  // Payment Modal
  const [selectedPayee, setSelectedPayee] = useState<Member | null>(null);
  const [payeeAmount, setPayeeAmount] = useState('');
  const [payeeReceiptFile, setPayeeReceiptFile] = useState<File | null>(null);
  
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  const month = getMonth(currentDate) + 1; // 1-12
  const year = getYear(currentDate);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchBill();
  }, [month, year]);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch members', error);
    }
  };

  const fetchBill = async () => {
    try {
      const res = await fetch(`/api/bills?month=${month}&year=${year}`);
      const data = await res.json();
      setBill(data);
    } catch (error) {
      console.error('Failed to fetch bill', error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName, email: newMemberEmail }),
      });
      setNewMemberName('');
      setNewMemberEmail('');
      setIsAddingMember(false);
      fetchMembers();
    } catch (error) {
      console.error('Failed to add member', error);
    }
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      await fetch(`/api/members/${memberToDelete.id}`, {
        method: 'DELETE',
      });
      setMemberToDelete(null);
      fetchMembers();
      fetchBill();
    } catch (error) {
      console.error('Failed to delete member', error);
    }
  };

  const handleMarkUnpaid = async (memberId: number) => {
    if (!bill) return;
    try {
      await fetch(`/api/member_payments/${bill.id}/${memberId}`, {
        method: 'DELETE',
      });
      fetchBill();
    } catch (error) {
      console.error('Failed to mark as unpaid', error);
    }
  };

  const handleSetBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billPayerId || !billTotalAmount) return;

    const formData = new FormData();
    formData.append('month', month.toString());
    formData.append('year', year.toString());
    formData.append('payer_id', billPayerId);
    formData.append('total_amount', billTotalAmount);
    if (billReceiptFile) {
      formData.append('receipt', billReceiptFile);
    }

    try {
      await fetch('/api/bills', {
        method: 'POST',
        body: formData,
      });
      setIsSettingBill(false);
      setBillPayerId('');
      setBillTotalAmount('');
      setBillReceiptFile(null);
      fetchBill();
    } catch (error) {
      console.error('Failed to set bill', error);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayee || !bill) return;

    const formData = new FormData();
    formData.append('bill_id', bill.id.toString());
    formData.append('member_id', selectedPayee.id.toString());
    formData.append('amount', payeeAmount);
    if (payeeReceiptFile) {
      formData.append('receipt', payeeReceiptFile);
    }

    try {
      await fetch('/api/member_payments', {
        method: 'POST',
        body: formData,
      });
      setSelectedPayee(null);
      setPayeeAmount('');
      setPayeeReceiptFile(null);
      fetchBill();
    } catch (error) {
      console.error('Failed to record payment', error);
    }
  };

  const getPaymentForMember = (memberId: number) => {
    return bill?.payments?.find(p => p.member_id === memberId);
  };

  const splitAmount = bill && members.length > 0 ? bill.total_amount / members.length : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">GroupPay</h1>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              &larr;
            </button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              &rarr;
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Monthly Overview</h2>
          <button 
            onClick={() => setIsAddingMember(true)}
            className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>

        {isAddingMember && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
            <h3 className="text-lg font-medium mb-4">Add New Member</h3>
            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Name" 
                required
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
              <input 
                type="email" 
                placeholder="Email (optional)" 
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
              <div className="flex space-x-2">
                <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800">
                  Save
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddingMember(false)}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {members.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500 mb-4">No members in the group yet.</p>
            <button 
              onClick={() => setIsAddingMember(true)}
              className="inline-flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add First Member</span>
            </button>
          </div>
        ) : !bill ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No bill recorded for {format(currentDate, 'MMMM yyyy')}</h3>
            <p className="text-gray-500 mb-6">Record the main subscription payment to start tracking paybacks.</p>
            <button 
              onClick={() => setIsSettingBill(true)}
              className="inline-flex items-center space-x-2 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm"
            >
              <DollarSign className="w-5 h-5" />
              <span>Record Monthly Bill</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* The Payer Section */}
            <section>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-gray-500" />
                <span>Main Bill (The Payer)</span>
              </h3>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Paid by</p>
                  <p className="font-medium text-lg">{bill.payer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                  <p className="font-medium text-lg">${bill.total_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Split per person ({members.length})</p>
                  <p className="font-medium text-lg text-indigo-600">${splitAmount.toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
                  {bill.receipt_url && (
                    <button 
                      onClick={() => setViewReceiptUrl(bill.receipt_url)}
                      className="flex items-center space-x-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>View Receipt</span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setBillPayerId(bill.payer_id.toString());
                      setBillTotalAmount(bill.total_amount.toString());
                      setIsSettingBill(true);
                    }}
                    className="text-sm font-medium text-gray-600 hover:text-black bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </section>

            {/* The Payees Section */}
            <section>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-gray-500" />
                <span>Group Members (The Payees)</span>
              </h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Member</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Receipt</th>
                      <th className="px-6 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {members.map(member => {
                      const isPayer = member.id === bill.payer_id;
                      const payment = getPaymentForMember(member.id);
                      const isPaid = isPayer || !!payment;

                      return (
                        <tr key={member.id} className={`transition-colors ${isPayer ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{member.name}</div>
                            {member.email && <div className="text-sm text-gray-500">{member.email}</div>}
                          </td>
                          <td className="px-6 py-4">
                            {isPayer ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Payer
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Payee
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isPayer ? (
                              <span className="text-gray-400 text-sm italic">N/A</span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Paid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-sm font-medium">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">
                            {isPayer ? (
                              <span className="text-gray-400">-</span>
                            ) : isPaid ? (
                              `$${payment!.amount.toFixed(2)}`
                            ) : (
                              `$${splitAmount.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {!isPayer && isPaid && payment?.receipt_url ? (
                              <button 
                                onClick={() => setViewReceiptUrl(payment.receipt_url!)}
                                className="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 text-sm font-medium"
                              >
                                <ImageIcon className="w-4 h-4" />
                                <span>View</span>
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {!isPayer && (
                                <>
                                  {isPaid ? (
                                    <>
                                      <button
                                        onClick={() => handleMarkUnpaid(member.id)}
                                        className="text-sm font-medium text-red-600 hover:text-red-800 hover:underline px-2 py-2"
                                      >
                                        Unpaid
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedPayee(member);
                                          setPayeeAmount(payment ? payment.amount.toString() : splitAmount.toFixed(2));
                                        }}
                                        className="text-sm font-medium text-black hover:underline px-2 py-2"
                                      >
                                        Update
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedPayee(member);
                                        setPayeeAmount(payment ? payment.amount.toString() : splitAmount.toFixed(2));
                                      }}
                                      className="text-sm font-medium text-black hover:underline px-2 py-2"
                                    >
                                      Mark as Paid
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => setMemberToDelete(member)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                                title="Delete Member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Bill Modal */}
      {isSettingBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Record Monthly Bill</h3>
              <button onClick={() => setIsSettingBill(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSetBill}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Who paid the bill?</label>
                <select
                  required
                  value={billPayerId}
                  onChange={e => setBillPayerId(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
                >
                  <option value="" disabled>Select a member</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={billTotalAmount}
                    onChange={e => setBillTotalAmount(e.target.value)}
                    className="block w-full pl-7 pr-3 border border-gray-300 rounded-lg py-2 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt (Optional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors bg-gray-50">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                        <span>Upload a file</span>
                        <input 
                          type="file" 
                          className="sr-only" 
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file && file.type.startsWith('image/')) {
                              setBillReceiptFile(file);
                            } else if (file) {
                              alert('Please upload an image file (PNG, JPG, etc.)');
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                    {billReceiptFile && (
                      <p className="text-sm font-medium text-emerald-600 mt-2">
                        Selected: {billReceiptFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSettingBill(false)}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payee Payment Modal */}
      {selectedPayee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Record Payback</h3>
              <button onClick={() => setSelectedPayee(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-1">Payee</p>
              <p className="font-medium">{selectedPayee.name}</p>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-1">Paying to</p>
              <p className="font-medium">{bill?.payer_name}</p>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payeeAmount}
                    onChange={e => setPayeeAmount(e.target.value)}
                    className="block w-full pl-7 pr-12 border border-gray-300 rounded-lg py-2 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt (Optional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors bg-gray-50">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                        <span>Upload a file</span>
                        <input 
                          type="file" 
                          className="sr-only" 
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file && file.type.startsWith('image/')) {
                              setPayeeReceiptFile(file);
                            } else if (file) {
                              alert('Please upload an image file (PNG, JPG, etc.)');
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                    {payeeReceiptFile && (
                      <p className="text-sm font-medium text-emerald-600 mt-2">
                        Selected: {payeeReceiptFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedPayee(null)}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Delete Member?</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete <strong>{memberToDelete.name}</strong>? This will also remove their payment records. This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setMemberToDelete(null)}
                className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMember}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer Modal */}
      {viewReceiptUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setViewReceiptUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewReceiptUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-8 h-8" />
            </button>
            {viewReceiptUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe src={viewReceiptUrl} className="w-full h-[80vh] rounded-lg bg-white" title="Receipt PDF" />
            ) : (
              <img src={viewReceiptUrl} alt="Receipt" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
