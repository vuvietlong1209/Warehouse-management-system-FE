'use client';
import {useWarehouse} from '@/context/WarehouseContext';
import {numberToVietnameseWords} from '@/lib/numberToWords';
import type {GoodsReceipt,GoodsIssue} from '@/types/warehouse';

export function ReceiptPrint({document}: {document: GoodsReceipt}) {
const {items}=useWarehouse();
const viewingPO=document;
        const totalAmount = viewingPO.items.reduce((s, i) => s + ((i.inventory_value ?? i.quantity_ordered * i.unit_price)), 0);
        const totalQty = viewingPO.items.reduce((s, i) => s + i.quantity_ordered, 0);
        const orderDateObj = new Date(viewingPO.order_date);
        const documentDate = isNaN(orderDateObj.getTime()) ? 'Chưa có ngày chứng từ'
          : `${String(orderDateObj.getUTCDate()).padStart(2, '0')}/${String(orderDateObj.getUTCMonth() + 1).padStart(2, '0')}/${String(orderDateObj.getUTCFullYear()).padStart(4, '0')}`;

return (              <div style={{fontFamily: '"Times New Roman", Times, serif'}} className="p-8 sm:p-10 printable-area bg-white text-black text-[13px] leading-relaxed space-y-3">
                {/* Header Top Section (No Logo - Clean Image 2 style) */}
                <div className="flex justify-between items-start border-b border-black pb-2">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="font-bold text-sm text-black uppercase">
                      ĐƠN VỊ: QUẢN LÝ KHO & THEO DÕI TỒN KHO
                    </p>
                    <p className="text-xs text-black">
                      Bộ phận: Quản lý hàng tồn kho - Nghiệp vụ Nhập kho
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">Mẫu số: 01 - VT</p>
                    <p className="italic text-[11px] text-gray-600">(TT 200/2014/TT-BTC)</p>
                  </div>
                </div>

                {/* Title & Date & Voucher Code */}
                <div className="text-center pt-2 pb-1">
                  <h1 className="text-xl font-bold uppercase text-black tracking-normal">
                    PHIẾU NHẬP KHO
                  </h1>
                  <p className="italic text-xs text-black mt-0.5">
                    Ngày {documentDate}
                  </p>
                  <p className="text-xs text-black mt-0.5">
                    Số chứng từ: <span className="font-semibold">{viewingPO.code}</span>
                  </p>
                </div>

                {/* Metadata Info Lines */}
                <div className="space-y-1 text-xs pt-1 text-black">
                  <p><span className="font-semibold">- Họ và tên người giao:</span> {viewingPO.partner_name || '....................................................................'}</p>
                  <p><span className="font-semibold">- Theo chứng từ:</span> Hóa đơn / Phiếu xuất số {viewingPO.code} ngày {documentDate} của {viewingPO.partner_name}</p>
                  <p><span className="font-semibold">- Nhập tại kho:</span> {viewingPO.warehouse_name} (Địa điểm: 244 Lê Thanh Nghị, Hà Nội)</p>
                  {viewingPO.description && (
                    <p><span className="font-semibold">- Ghi chú:</span> {viewingPO.description}</p>
                  )}
                </div>

                {/* Table - Clean crisp borders matching Image 2 */}
                <div className="pt-2">
                  <table className="w-full border-collapse border border-black text-xs text-center" style={{ border: '1px solid #000' }}>
                    <thead>
                      <tr className="bg-slate-50 font-bold" style={{ backgroundColor: '#f8fafc' }}>
                        <th className="stt-column border border-black py-2 px-1.5 w-10">STT</th>
                        <th className="border border-black py-2 px-2 text-left">Tên, quy cách hàng hóa</th>
                        <th className="border border-black py-2 px-1.5 w-24">Mã số</th>
                        <th className="border border-black py-2 px-1.5 w-16">ĐVT</th>
                        <th className="border border-black py-2 px-1.5 w-20">Số lượng</th>
                        <th className="border border-black py-2 px-2 w-28 text-right">Đơn giá (VND)</th>
                        <th className="border border-black py-2 px-2 w-32 text-right">Thành tiền (VND)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingPO.items.map((pi, idx) => {
                        const itm = items.find(it => it.id === pi.item_id || it.code === pi.item_code);
                        const unitName = itm?.base_unit_name || 'Cái';
                        const lineTotal = (pi.inventory_value ?? pi.quantity_ordered * pi.unit_price);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="stt-column border border-black py-2 px-1">{idx + 1}</td>
                            <td className="border border-black py-2 px-2 text-left font-medium">{pi.item_name}</td>
                            <td className="border border-black py-2 px-1">{pi.item_code}</td>
                            <td className="border border-black py-2 px-1">{unitName}</td>
                            <td className="border border-black py-2 px-1 font-bold">{pi.quantity_ordered.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-2 text-right">{pi.unit_price.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-2 text-right font-semibold">{lineTotal.toLocaleString('vi-VN')}</td>
                          </tr>
                        );
                      })}
                      {/* Tổng cộng Row */}
                      <tr className="font-bold bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                        <td className="border border-black py-2.5 px-2 text-center" colSpan={4}>Tổng cộng</td>
                        <td className="border border-black py-2.5 px-1 text-center font-bold">{totalQty.toLocaleString('vi-VN')}</td>
                        <td className="border border-black py-2.5 px-1 text-center"></td>
                        <td className="border border-black py-2.5 px-2 text-right font-bold text-black">{totalAmount.toLocaleString('vi-VN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Sum in Words & Attachments */}
                <div className="space-y-1 text-xs pt-1 text-black">
                  <p>
                    <span className="font-semibold">- Tổng số tiền (viết bằng chữ):</span> <span className="font-bold italic">{numberToVietnameseWords(totalAmount)}</span>
                  </p>
                  <p>
                    <span className="font-semibold">- Chứng từ kèm theo:</span> <span className="italic">01 bộ hóa đơn và biên bản giao nhận hàng</span>
                  </p>
                </div>

                {/* Signatures Section matching Image 2 */}
                <div className="pt-4">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                    <p data-document-signature-date className="col-start-4 italic">Hà Nội, ngày {documentDate}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold uppercase">Người lập phiếu</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center">
                        <span className="font-semibold text-black">{viewingPO.user_name || 'Nguyễn Văn A'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Người giao hàng</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center">
                        <span className="font-semibold text-black">{viewingPO.partner_name || 'Đại diện NCC'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Thủ kho</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                    <div>
                      <p className="font-bold uppercase">Kế toán trưởng</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                  </div>
                </div>
              </div>);
}

export function IssuePrint({document}: {document: GoodsIssue}) {
const {items}=useWarehouse();
const viewingSO=document;
        const totalAmount = viewingSO.items.reduce((s, i) => s + (i.quantity_ordered * i.unit_price), 0);
        const totalQty = viewingSO.items.reduce((s, i) => s + i.quantity_ordered, 0);
        const orderDateObj = new Date(viewingSO.order_date);
        const documentDate = isNaN(orderDateObj.getTime()) ? 'Chưa có ngày chứng từ'
          : `${String(orderDateObj.getUTCDate()).padStart(2, '0')}/${String(orderDateObj.getUTCMonth() + 1).padStart(2, '0')}/${String(orderDateObj.getUTCFullYear()).padStart(4, '0')}`;

return (              <div style={{fontFamily: '"Times New Roman", Times, serif'}} className="p-8 sm:p-10 printable-area bg-white text-black text-[13px] leading-relaxed space-y-3">
                {/* Header Top Section (No Logo - Clean Image 2 style) */}
                <div className="flex justify-between items-start border-b border-black pb-2">
                  <div className="space-y-0.5 max-w-[70%]">
                    <p className="font-bold text-sm text-black uppercase">
                      ĐƠN VỊ: QUẢN LÝ KHO & THEO DÕI TỒN KHO
                    </p>
                    <p className="text-xs text-black">
                      Bộ phận: Quản lý hàng tồn kho - Nghiệp vụ Xuất kho
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">Mẫu số: 02 - VT</p>
                    <p className="italic text-[11px] text-gray-600">(TT 200/2014/TT-BTC)</p>
                  </div>
                </div>

                {/* Title & Date & Voucher Code */}
                <div className="text-center pt-2 pb-1">
                  <h1 className="text-xl font-bold uppercase text-black tracking-normal">
                    PHIẾU XUẤT KHO
                  </h1>
                  <p className="italic text-xs text-black mt-0.5">
                    Ngày {documentDate}
                  </p>
                  <p className="text-xs text-black mt-0.5">
                    Số chứng từ: <span className="font-semibold">{viewingSO.code}</span>
                  </p>
                </div>

                {/* Metadata Info Lines */}
                <div className="space-y-1 text-xs pt-1 text-black">
                  <p><span className="font-semibold">- Họ và tên người nhận hàng:</span> {viewingSO.partner_name || '....................................................................'}</p>
                  <p><span className="font-semibold">- Lý do xuất kho:</span> {viewingSO.description || `Xuất bán thiết bị điện tử theo phiếu ${viewingSO.code}`}</p>
                  <p><span className="font-semibold">- Xuất tại kho:</span> {viewingSO.warehouse_name} (Địa điểm: 244 Lê Thanh Nghị, Hà Nội)</p>
                </div>

                {/* Table - Clean crisp borders matching Image 2 */}
                <div className="pt-2">
                  <table className="w-full border-collapse border border-black text-xs text-center" style={{ border: '1px solid #000' }}>
                    <thead>
                      <tr className="bg-slate-50 font-bold" style={{ backgroundColor: '#f8fafc' }}>
                        <th className="stt-column border border-black py-2 px-1.5 w-10">STT</th>
                        <th className="border border-black py-2 px-2 text-left">Tên, quy cách hàng hóa</th>
                        <th className="border border-black py-2 px-1.5 w-24">Mã số</th>
                        <th className="border border-black py-2 px-1.5 w-16">ĐVT</th>
                        <th className="border border-black py-2 px-1.5 w-20">Số lượng</th>
                        <th className="border border-black py-2 px-2 w-28 text-right">Đơn giá (VND)</th>
                        <th className="border border-black py-2 px-2 w-32 text-right">Thành tiền (VND)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingSO.items.map((si, idx) => {
                        const itm = items.find(it => it.id === si.item_id || it.code === si.item_code);
                        const unitName = itm?.base_unit_name || 'Cái';
                        const lineTotal = si.quantity_ordered * si.unit_price;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="stt-column border border-black py-2 px-1">{idx + 1}</td>
                            <td className="border border-black py-2 px-2 text-left font-medium">{si.item_name}</td>
                            <td className="border border-black py-2 px-1">{si.item_code}</td>
                            <td className="border border-black py-2 px-1">{unitName}</td>
                            <td className="border border-black py-2 px-1 font-bold">{si.quantity_ordered.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-2 text-right">{si.unit_price.toLocaleString('vi-VN')}</td>
                            <td className="border border-black py-2 px-2 text-right font-semibold">{lineTotal.toLocaleString('vi-VN')}</td>
                          </tr>
                        );
                      })}
                      {/* Tổng cộng Row */}
                      <tr className="font-bold bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                        <td className="border border-black py-2.5 px-2 text-center" colSpan={4}>Tổng cộng</td>
                        <td className="border border-black py-2.5 px-1 text-center font-bold">{totalQty.toLocaleString('vi-VN')}</td>
                        <td className="border border-black py-2.5 px-1 text-center"></td>
                        <td className="border border-black py-2.5 px-2 text-right font-bold text-black">{totalAmount.toLocaleString('vi-VN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Sum in Words & Attachments */}
                <div className="space-y-1 text-xs pt-1 text-black">
                  <p>
                    <span className="font-semibold">- Tổng số tiền (viết bằng chữ):</span> <span className="font-bold italic">{numberToVietnameseWords(totalAmount)}</span>
                  </p>
                  <p>
                    <span className="font-semibold">- Chứng từ kèm theo:</span> <span className="italic">01 bản lệnh xuất kho / phiếu yêu cầu xuất</span>
                  </p>
                </div>

                {/* Signatures Section matching Image 2 */}
                <div className="pt-4">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                    <p data-document-signature-date className="col-start-4 italic">Hà Nội, ngày {documentDate}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold uppercase">Người lập phiếu</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center">
                        <span className="font-semibold text-black">{viewingSO.user_name || 'Nguyễn Văn A'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Người nhận hàng</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center">
                        <span className="font-semibold text-black">{viewingSO.partner_name || 'Khách hàng'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold uppercase">Thủ kho</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                    <div>
                      <p className="font-bold uppercase">Kế toán trưởng</p>
                      <p className="italic text-[11px] text-gray-500">(Ký, ghi rõ họ tên)</p>
                      <div className="h-16 flex items-end justify-center" />
                    </div>
                  </div>
                </div>
              </div>);
}
