/* ================= report.js v3.0 ================= */
/* 报表统计：按时间查账 + 按客户查账 */
/* 含：N9报表日期、N18按客户搜索、U2修复 */

var currentReportType = 'time';
var _reportCustomerList = [];

/* ========== 加载报表（入口函数） ========== */
function loadReport(type) {
  if (type) currentReportType = type;
  var timeRange = document.getElementById('report-time-range').value;
  var customDates = document.getElementById('report-custom-dates');
  customDates.style.display = (timeRange === 'custom') ? 'flex' : 'none';

  var searchBox = document.getElementById('report-search-box');
  if (searchBox) searchBox.style.display = (currentReportType === 'customer') ? 'block' : 'none';

  var range = getReportDateRange();
  if (currentReportType === 'time') {
    loadTimeReport(range.start, range.end);
  } else {
    loadCustomerReport(range.start, range.end);
  }
}

/* ========== 获取日期范围 ========== */
function getReportDateRange() {
  var timeRange = document.getElementById('report-time-range').value;
  var start, end;
  if (timeRange === 'today') {
    start = getTodayString();
    end = getTodayString();
  } else if (timeRange === 'month') {
    start = getMonthStartString();
    end = getTodayString();
  } else {
    start = document.getElementById('report-date-start').value || getMonthStartString();
    end = document.getElementById('report-date-end').value || getTodayString();
  }
  return { start: start, end: end };
}

/* ========== 获取时间范围显示文字 ========== */
function getReportDateLabel() {
  var timeRange = document.getElementById('report-time-range').value;
  if (timeRange === 'today') {
    return getTodayString();
  } else if (timeRange === 'month') {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  } else {
    return '';
  }
}

/* ========== 按时间查账 ========== */
function loadTimeReport(startDate, endDate) {
  dbGetAll('orders', function(orders) {
    var filtered = orders.filter(function(o) {
      if (!o.date) return false;
      var d = o.date.substring(0, 10);
      return d >= startDate && d <= endDate;
    });

    filtered.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

    var totalAmount = 0, settledAmount = 0, unsettledAmount = 0;
    for (var i = 0; i < filtered.length; i++) {
      var o = filtered[i];
      totalAmount += o.totalAmount || 0;
      if (o.settled) {
        settledAmount += o.totalAmount || 0;
      } else {
        unsettledAmount += (o.totalAmount || 0) - (o.paidAmount || 0);
      }
    }

    var dateLabel = getReportDateLabel();
    var summaryHtml = '';
    if (dateLabel) {
      summaryHtml += '<div class="stat-card"><span class="stat-label">总金额（' + dateLabel + '）</span><span class="stat-value">' + formatMoney(totalAmount) + '</span></div>';
    } else {
      summaryHtml += '<div class="stat-card"><span class="stat-label">总金额</span><span class="stat-value">' + formatMoney(totalAmount) + '</span></div>';
    }
    summaryHtml += '<div class="stat-card"><span class="stat-label">已结清</span><span class="stat-value">' + formatMoney(settledAmount) + '</span></div>';
    summaryHtml += '<div class="stat-card"><span class="stat-label">未结清</span><span class="stat-value">' + formatMoney(unsettledAmount) + '</span></div>';
    document.getElementById('report-summary').innerHTML = summaryHtml;

    var contentHtml = '';
    if (filtered.length === 0) {
      contentHtml = '<div class="empty-tip">该时间段内没有订单</div>';
    } else {
      for (var j = 0; j < filtered.length; j++) {
        var ro = filtered[j];
        var isRefund = ro.isRefund || (ro.totalAmount < 0);
        var avatarCls = 'order-avatar';
        var amtCls = 'order-amount';
        var statusCls = 'order-status';
        var statusText = '';

        if (isRefund) {
          avatarCls += ' unpaid'; amtCls += ' refund'; statusCls += ' refund'; statusText = '退货';
        } else if (ro.settled) {
          statusCls += ' settled'; statusText = '已结清';
        } else {
          avatarCls += ' unpaid'; amtCls += ' unpaid'; statusCls += ' unsettled'; statusText = '未结清';
        }

        var firstChar = (ro.customerName || '未').substring(0, 1);
        contentHtml += '<div class="order-item" onclick="viewOrder(' + ro.id + ')">';
        contentHtml += '<div class="' + avatarCls + '">' + firstChar + '</div>';
        contentHtml += '<div class="order-info">';
        contentHtml += '<div class="order-top">';
        contentHtml += '<span class="order-customer">' + (ro.customerName || '未知') + '</span>';
        contentHtml += '<span class="' + amtCls + '">' + formatMoney(ro.totalAmount) + '</span>';
        contentHtml += '</div>';
        contentHtml += '<div class="order-meta">';
        contentHtml += '<span class="order-time">' + (ro.date || '').substring(0, 16) + '</span>';
        contentHtml += '<span class="' + statusCls + '">' + statusText + '</span>';
        if (ro.summary) contentHtml += '<span class="order-summary">' + ro.summary + '</span>';
        contentHtml += '</div>';
        contentHtml += '</div></div>';
      }
    }
    document.getElementById('report-content').innerHTML = contentHtml;
  });
}

/* ========== 按客户查账 ========== */
function loadCustomerReport(startDate, endDate) {
  dbGetAll('customers', function(customers) {
    dbGetAll('orders', function(orders) {
      var filtered = orders.filter(function(o) {
        if (!o.date) return false;
        var d = o.date.substring(0, 10);
        return d >= startDate && d <= endDate;
      });

      var customerMap = {};
      for (var i = 0; i < filtered.length; i++) {
        var o = filtered[i];
        var cid = o.customerId;
        if (!customerMap[cid]) {
          customerMap[cid] = { name: o.customerName || '未知', total: 0, settled: 0, unsettled: 0, count: 0 };
        }
        customerMap[cid].total += o.totalAmount || 0;
        customerMap[cid].count++;
        if (o.settled) {
          customerMap[cid].settled += o.totalAmount || 0;
        } else {
          customerMap[cid].unsettled += (o.totalAmount || 0) - (o.paidAmount || 0);
        }
      }

      for (var c = 0; c < customers.length; c++) {
        if (customerMap[customers[c].id]) {
          customerMap[customers[c].id].name = customers[c].name;
        }
      }

      var list = [];
      for (var key in customerMap) {
        if (customerMap.hasOwnProperty(key)) {
          customerMap[key].id = parseInt(key);
          list.push(customerMap[key]);
        }
      }
      list.sort(function(a, b) { return b.unsettled - a.unsettled; });
      _reportCustomerList = list;

      var grandTotal = 0, grandSettled = 0, grandUnsettled = 0;
      for (var k = 0; k < list.length; k++) {
        grandTotal += list[k].total;
        grandSettled += list[k].settled;
        grandUnsettled += list[k].unsettled;
      }

      var dateLabel = getReportDateLabel();
      var summaryHtml = '';
      if (dateLabel) {
        summaryHtml += '<div class="stat-card"><span class="stat-label">总金额（' + dateLabel + '）</span><span class="stat-value">' + formatMoney(grandTotal) + '</span></div>';
      } else {
        summaryHtml += '<div class="stat-card"><span class="stat-label">总金额</span><span class="stat-value">' + formatMoney(grandTotal) + '</span></div>';
      }
      summaryHtml += '<div class="stat-card"><span class="stat-label">已结清</span><span class="stat-value">' + formatMoney(grandSettled) + '</span></div>';
      summaryHtml += '<div class="stat-card"><span class="stat-label">欠款</span><span class="stat-value">' + formatMoney(grandUnsettled) + '</span></div>';
      document.getElementById('report-summary').innerHTML = summaryHtml;

      renderCustomerReportList(list);
    });
  });
}

/* ========== 渲染客户报表列表 ========== */
function renderCustomerReportList(list) {
  var contentHtml = '';
  if (list.length === 0) {
    contentHtml = '<div class="empty-tip">该时间段内没有订单</div>';
  } else {
    for (var m = 0; m < list.length; m++) {
      var item = list[m];
      var firstChar = (item.name || '?').substring(0, 1);
      contentHtml += '<div class="order-item" onclick="showCustomerDetail(' + item.id + ')">';
      contentHtml += '<div class="order-avatar">' + firstChar + '</div>';
      contentHtml += '<div class="order-info">';
      contentHtml += '<div class="order-top">';
      contentHtml += '<span class="order-customer">' + item.name + '</span>';
      contentHtml += '<span class="order-amount">' + formatMoney(item.total) + '</span>';
      contentHtml += '</div>';
      contentHtml += '<div class="order-meta">';
      contentHtml += '<span class="order-time">' + item.count + '笔订单</span>';
      if (item.unsettled > 0) {
        contentHtml += '<span class="order-status unsettled">欠 ' + formatMoney(item.unsettled) + '</span>';
      } else {
        contentHtml += '<span class="order-status settled">已结清</span>';
      }
      contentHtml += '</div>';
      contentHtml += '</div></div>';
    }
  }
  document.getElementById('report-content').innerHTML = contentHtml;
}

/* ========== 按客户名搜索过滤 ========== */
function filterReportCustomer() {
  var keyword = document.getElementById('report-customer-search').value.trim().toLowerCase();
  if (!keyword) {
    renderCustomerReportList(_reportCustomerList);
    return;
  }
  var filtered = _reportCustomerList.filter(function(item) {
    return item.name && item.name.toLowerCase().indexOf(keyword) >= 0;
  });
  renderCustomerReportList(filtered);
}
