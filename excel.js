/* ================= excel.js ================= */
/* Excel导出（使用SheetJS库） */

function loadXLSX(callback) {
    if (typeof XLSX !== 'undefined') { callback(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = callback;
    s.onerror = function() { showToast('导出组件加载失败，请检查网络'); };
    document.head.appendChild(s);
}

/* ---------- 导出入口 ---------- */

function exportExcel() {
    var bodyHTML = '<div class="settings-menu">'
        + '<div class="menu-item" onclick="closeModal();doExportOrderDetail()"><span class="menu-text">订单明细表</span><span class="menu-arrow">›</span></div>'
        + '<div class="menu-item" onclick="closeModal();doExportOrderSummary()"><span class="menu-text">订单汇总表</span><span class="menu-arrow">›</span></div>'
        + '<div class="menu-item" onclick="closeModal();doExportCustomerSummary()"><span class="menu-text">客户汇总表</span><span class="menu-arrow">›</span></div>'
        + '</div>';
    showModal('选择导出类型', bodyHTML, '<button class="btn-secondary" onclick="closeModal()">取消</button>');
}

function showExportOptions() { exportExcel(); }
/* ---------- 订单明细表 ---------- */

function doExportOrderDetail() {
    loadXLSX(function() {
        dbGetAll('orders', function(orders) {
            dbGetAll('orderItems', function(allItems) {
                var rows = [['日期', '单号', '客户', '地址', '商品', '数量', '单价', '小计', '状态']];
                orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var items = allItems.filter(function(it) { return it.orderId === o.id; });
                    if (items.length === 0) {
                        rows.push([o.date, o.orderNo, o.customerName, o.address || '', '', '', '', formatMoney(o.totalAmount), o.settled ? '已结清' : '未结清']);
                    } else {
                        for (var j = 0; j < items.length; j++) {
                            rows.push([
                                j === 0 ? o.date : '',
                                j === 0 ? o.orderNo : '',
                                j === 0 ? o.customerName : '',
                                j === 0 ? (o.address || '') : '',
                                items[j].productName,
                                items[j].quantity,
                                items[j].price,
                                formatMoney(items[j].subtotal || 0),
                                j === 0 ? (o.settled ? '已结清' : '未结清') : ''
                            ]);
                        }
                    }
                }

                var ws = XLSX.utils.aoa_to_sheet(rows);
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '订单明细');
                XLSX.writeFile(wb, '订单明细_' + getTodayString() + '.xlsx');
                showToast('导出成功');
            });
        });
    });
}
/* ---------- 订单明细表 ---------- */

function doExportOrderDetail() {
    loadXLSX(function() {
        dbGetAll('orders', function(orders) {
            dbGetAll('orderItems', function(allItems) {
                var rows = [['日期', '单号', '客户', '地址', '商品', '数量', '单价', '小计', '状态']];
                orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var items = allItems.filter(function(it) { return it.orderId === o.id; });
                    if (items.length === 0) {
                        rows.push([o.date, o.orderNo, o.customerName, o.address || '', '', '', '', formatMoney(o.totalAmount), o.settled ? '已结清' : '未结清']);
                    } else {
                        for (var j = 0; j < items.length; j++) {
                            rows.push([
                                j === 0 ? o.date : '',
                                j === 0 ? o.orderNo : '',
                                j === 0 ? o.customerName : '',
                                j === 0 ? (o.address || '') : '',
                                items[j].productName,
                                items[j].quantity,
                                items[j].price,
                                formatMoney(items[j].subtotal || 0),
                                j === 0 ? (o.settled ? '已结清' : '未结清') : ''
                            ]);
                        }
                    }
                }

                var ws = XLSX.utils.aoa_to_sheet(rows);
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '订单明细');
                XLSX.writeFile(wb, '订单明细_' + getTodayString() + '.xlsx');
                showToast('导出成功');
            });
        });
    });
}
