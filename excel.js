/* ================= excel.js v3.0 ================= */
/* Excel导出功能 */
/* 含：B3本地引用xlsx、N4客户对账单、N5一键ZIP、N16时间筛选 */

/* ========== B3修复：加载本地XLSX库 ========== */
function loadXLSX(callback) {
  if (typeof XLSX !== 'undefined') { callback(); return; }

  var s = document.createElement('script');
  // B3：优先用本地文件，回退CDN
  s.src = 'xlsx.min.js';
  s.onload = callback;
  s.onerror = function() {
    // 本地文件不存在时尝试CDN（备用）
    var s2 = document.createElement('script');
    s2.src = 'https://cdn.bootcdn.net/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s2.onload = callback;
    s2.onerror = function() {
      showToast('导出组件加载失败，请检查网络');
    };
    document.head.appendChild(s2);
  };
  document.head.appendChild(s);
}

/* ========== 导出入口（N16：加时间筛选） ========== */
function exportExcel() {
  var bodyHTML = '';

  // N16：时间范围选择
  bodyHTML += '<div class="form-section">';
  bodyHTML += '<label class="form-label">导出时间范围</label>';
  bodyHTML += '<select class="form-select" id="export-time-range">';
  bodyHTML += '<option value="all">全部数据</option>';
  bodyHTML += '<option value="today">今天</option>';
  bodyHTML += '<option value="month">本月</option>';
  bodyHTML += '<option value="custom">自定义</option>';
  bodyHTML += '</select>';
  bodyHTML += '<div id="export-custom-dates" style="display:none;margin-top:8px;">';
  bodyHTML += '<div style="display:flex;gap:8px;align-items:center;">';
  bodyHTML += '<input type="date" class="form-input" id="export-date-start" style="flex:1;" />';
  bodyHTML += '<span style="color:#8A9BB0;">至</span>';
  bodyHTML += '<input type="date" class="form-input" id="export-date-end" style="flex:1;" />';
  bodyHTML += '</div></div>';
  bodyHTML += '</div>';

  // 导出类型
  bodyHTML += '<div class="menu-item" onclick="doExportOrderDetail()" style="cursor:pointer;">';
  bodyHTML += '<span class="menu-text">订单明细表</span><span class="menu-arrow">›</span></div>';

  bodyHTML += '<div class="menu-item" onclick="doExportOrderSummary()" style="cursor:pointer;">';
  bodyHTML += '<span class="menu-text">订单汇总表</span><span class="menu-arrow">›</span></div>';

  bodyHTML += '<div class="menu-item" onclick="doExportCustomerSummary()" style="cursor:pointer;">';
  bodyHTML += '<span class="menu-text">客户汇总表</span><span class="menu-arrow">›</span></div>';

  bodyHTML += '<div class="menu-item" onclick="showExportCustomerBill()" style="cursor:pointer;">';
  bodyHTML += '<span class="menu-text">客户对账单（N4）</span><span class="menu-arrow">›</span></div>';

  showModal('导出Excel', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">关闭</button>'
  );

  // 监听时间范围变化
  setTimeout(function() {
    var sel = document.getElementById('export-time-range');
    if (sel) {
      sel.onchange = function() {
        var customDiv = document.getElementById('export-custom-dates');
        if (customDiv) customDiv.style.display = (sel.value === 'custom') ? 'block' : 'none';
      };
    }
  }, 100);
}

/* ========== N16：获取导出时间范围 ========== */
function getExportDateRange() {
  var sel = document.getElementById('export-time-range');
  if (!sel) return { start: null, end: null };

  var range = sel.value;
  if (range === 'all') return { start: null, end: null };
  if (range === 'today') return { start: getTodayString(), end: getTodayString() };
  if (range === 'month') return { start: getMonthStartString(), end: getTodayString() };

  return {
    start: document.getElementById('export-date-start').value || null,
    end: document.getElementById('export-date-end').value || null
  };
}

function filterOrdersByDate(orders, range) {
  if (!range.start && !range.end) return orders;
  return orders.filter(function(o) {
    if (!o.date) return false;
    var d = o.date.substring(0, 10);
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  });
}

/* ========== 订单明细表 ========== */
function doExportOrderDetail() {
  loadXLSX(function() {
    var range = getExportDateRange();
    dbGetAll('orders', function(orders) {
      dbGetAll('orderItems', function(allItems) {
        orders = filterOrdersByDate(orders, range);
        var rows = [['日期', '单号', '客户', '电话', '地址', '商品', '数量', '单价', '小计', '状态']];

        orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
        var grandTotal = 0;

        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          grandTotal += o.totalAmount || 0;
          var items = allItems.filter(function(it) { return it.orderId === o.id; });
          var status = o.isRefund ? '退货' : (o.settled ? '已结清' : '未结清');

          if (items.length === 0) {
            rows.push([o.date, o.orderNo, o.customerName, '', o.address || '', '', '', '', o.totalAmount || 0, status]);
          } else {
            for (var j = 0; j < items.length; j++) {
              rows.push([
                j === 0 ? o.date : '', j === 0 ? o.orderNo : '',
                j === 0 ? o.customerName : '', '', j === 0 ? (o.address || '') : '',
                items[j].productName, items[j].quantity, items[j].price,
                items[j].subtotal || 0, j === 0 ? status : ''
              ]);
            }
          }
        }

        rows.push(['', '', '', '', '', '', '', '合计', grandTotal, '']);

        var ws = XLSX.utils.aoa_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '订单明细');
        XLSX.writeFile(wb, '订单明细_' + getTodayString() + '.xlsx');
        showToast('导出成功');
      });
    });
  });
}

/* ========== 订单汇总表 ========== */
function doExportOrderSummary() {
  loadXLSX(function() {
    var range = getExportDateRange();
    dbGetAll('orders', function(orders) {
      orders = filterOrdersByDate(orders, range);
      var rows = [['日期', '单号', '客户', '地址', '商品摘要', '总金额', '状态']];

      orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
      var total = 0;

      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        total += o.totalAmount || 0;
        var status = o.isRefund ? '退货' : (o.settled ? '已结清' : '未结清');
        rows.push([o.date, o.orderNo, o.customerName, o.address || '', o.summary || '', o.totalAmount || 0, status]);
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

/* ========== 客户汇总表 ========== */
function doExportCustomerSummary() {
  loadXLSX(function() {
    var range = getExportDateRange();
    dbGetAll('customers', function(customers) {
      dbGetAll('orders', function(orders) {
        orders = filterOrdersByDate(orders, range);
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
          if (total !== 0 || unsettled !== 0) {
            rows.push([c.name, c.phone || '', total, settled, unsettled]);
          }
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

/* ========== N4：客户对账单 ========== */
function showExportCustomerBill() {
  closeModal();

  dbGetAll('customers', function(customers) {
    var bodyHTML = '<div class="form-section">';
    bodyHTML += '<label class="form-label">选择客户</label>';
    bodyHTML += '<select class="form-select" id="bill-customer-select">';
    for (var i = 0; i < customers.length; i++) {
      bodyHTML += '<option value="' + customers[i].id + '">' + customers[i].name + '</option>';
    }
    bodyHTML += '</select>';
    bodyHTML += '</div>';

    showModal('导出客户对账单', bodyHTML,
      '<button class="btn-secondary" onclick="closeModal();exportExcel();">返回</button>' +
      '<button class="btn-primary" onclick="doExportCustomerBill()">导出</button>'
    );
  });
}

function doExportCustomerBill() {
  var customerId = parseInt(document.getElementById('bill-customer-select').value);
  if (!customerId) { showToast('请选择客户'); return; }

  loadXLSX(function() {
    dbGet('customers', customerId, function(customer) {
      if (!customer) { showToast('客户不存在'); return; }

      dbGetAll('orders', function(orders) {
        dbGetAll('orderItems', function(allItems) {
          var customerOrders = orders.filter(function(o) { return o.customerId === customerId; });
          customerOrders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

          var rows = [
            [customer.name + ' 对账单'],
            ['电话：' + (customer.phone || '无')],
            [],
            ['日期', '商品', '数量', '单价', '小计', '地址', '状态']
          ];

          var totalAmount = 0, settledAmount = 0, unsettledAmount = 0;

          for (var i = 0; i < customerOrders.length; i++) {
            var o = customerOrders[i];
            totalAmount += o.totalAmount || 0;
            if (o.settled) { settledAmount += o.totalAmount || 0; }
            else { unsettledAmount += (o.totalAmount || 0) - (o.paidAmount || 0); }

            var items = allItems.filter(function(it) { return it.orderId === o.id; });
            var status = o.isRefund ? '退货' : (o.settled ? '已结清' : '未结清');

            if (items.length === 0) {
              rows.push([o.date, '', '', '', o.totalAmount || 0, o.address || '', status]);
            } else {
              for (var j = 0; j < items.length; j++) {
                rows.push([
                  j === 0 ? o.date : '',
                  items[j].productName, items[j].quantity, items[j].price,
                  items[j].subtotal || 0,
                  j === 0 ? (o.address || '') : '',
                  j === 0 ? status : ''
                ]);
              }
            }
          }

          rows.push([]);
          rows.push(['', '', '', '总金额', totalAmount]);
          rows.push(['', '', '', '已结清', settledAmount]);
          rows.push(['', '', '', '欠款', unsettledAmount]);

          var ws = XLSX.utils.aoa_to_sheet(rows);
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, customer.name + '对账单');
          XLSX.writeFile(wb, customer.name + '对账单.xlsx');
          closeModal();
          showToast('导出成功');
        });
      });
    });
  });
}
