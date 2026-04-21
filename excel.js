/* ================= excel.js ================= */

function loadXLSX(callback) {
    if (typeof XLSX !== 'undefined') { callback(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = callback;
    s.onerror = function() {
        s.src = 'https://cdn.bootcdn.net/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = callback;
        s.onerror = function() { showToast('导出组件加载失败，请检查网络'); };
        document.head.appendChild(s);
    };
    document.head.appendChild(s);
}

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
                var grandTotal = 0;
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    grandTotal += o.totalAmount || 0;
                    var items = allItems.filter(function(it) { return it.orderId === o.id; });
                    if (items.length === 0) {
                        rows.push([o.date, o.orderNo, o.customerName, o.address || '', '', '', '', o.totalAmount || 0, o.settled ? '已结清' : '未结清']);
                    } else {
                        for (var j = 0; j < items.length; j++) {
                            rows.push([
                                j === 0 ? o.date : '', j === 0 ? o.orderNo : '',
                                j === 0 ? o.customerName : '', j === 0 ? (o.address || '') : '',
                                items[j].productName, items[j].quantity, items[j].price,
                                items[j].subtotal || 0,
                                j === 0 ? (o.settled ? '已结清' : '未结清') : ''
                            ]);
                        }
                    }
                }
                rows.push(['', '', '', '', '', '', '合计', grandTotal, '']);
                var ws = XLSX.utils.aoa_to_sheet(rows);
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '订单明细');
                XLSX.writeFile(wb, '订单明细_' + getTodayString() + '.xlsx');
                showToast('导出成功');
            });
        });
    });
}

/* ---------- 订单汇总表 ---------- */

function doExportOrderSummary() {
    loadXLSX(function() {
        dbGetAll('orders', function(orders) {
            var rows = [['日期', '单号', '客户', '地址', '商品摘要', '总金额', '状态']];
            orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
            var total = 0;
            for (var i = 0; i < orders.length; i++) {
                var o = orders[i];
                total += o.totalAmount || 0;
                rows.push([o.date, o.orderNo, o.customerName, o.address || '', o.summary || '', o.totalAmount || 0, o.settled ? '已结清' : '未结清']);
            }
            rows.push(['', '', '', '', '合计', total, '']);
            var ws = XLSX.utils.aoa_to_sheet(rows);
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '订单汇总');
            XLSX.writeFile(wb, '订单汇总_' + getTodayString() + '.xlsx');
            showToast('导出成功');
        });
    });
}
/* ---------- 客户汇总表 ---------- */

function doExportCustomerSummary() {
    loadXLSX(function() {
        dbGetAll('customers', function(customers) {
            dbGetAll('orders', function(orders) {
                var rows = [['客户', '电话', '总金额', '已结清', '未结清（欠款）']];
                for (var i = 0; i < customers.length; i++) {
                    var c = customers[i];
                    var total = 0, settled = 0, unsettled = 0;
                    for (var j = 0; j < orders.length; j++) {
                        if (orders[j].customerId === c.id) {
                            total += orders[j].totalAmount || 0;
                            if (orders[j].settled) {
                                settled += orders[j].totalAmount || 0;
                            } else {
                                unsettled += (orders[j].totalAmount || 0) - (orders[j].paidAmount || 0);
                            }
                        }
                    }
                    rows.push([c.name, c.phone || '', total, settled, unsettled]);
                }
                var ws = XLSX.utils.aoa_to_sheet(rows);
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '客户汇总');
                XLSX.writeFile(wb, '客户汇总_' + getTodayString() + '.xlsx');
                showToast('导出成功');
            });
        });
    });
}

