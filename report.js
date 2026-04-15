/* ================= report.js ================= */
/* 报表统计：按时间查账 + 按客户查账 */

var currentReportType = 'time';

/* ---------- 加载报表（入口函数） ---------- */

function loadReport(type) {
    if (type) currentReportType = type;

    var timeRange = document.getElementById('report-time-range').value;
    var customDates = document.getElementById('report-custom-dates');
    customDates.style.display = (timeRange === 'custom') ? 'flex' : 'none';

    var range = getReportDateRange();

    if (currentReportType === 'time') {
        loadTimeReport(range.start, range.end);
    } else {
        loadCustomerReport(range.start, range.end);
    }
}

/* ---------- 获取日期范围 ---------- */

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

/* ---------- 按时间查账 ---------- */

function loadTimeReport(startDate, endDate) {
    dbGetAll('orders', function(orders) {
        var filtered = orders.filter(function(o) {
            if (!o.date) return false;
            var d = o.date.substring(0, 10);
            return d >= startDate && d <= endDate;
        });

        filtered.sort(function(a, b) {
            return b.date > a.date ? 1 : -1;
        });

        var totalAmount = 0;
        var settledAmount = 0;
        var unsettledAmount = 0;

        for (var i = 0; i < filtered.length; i++) {
            var o = filtered[i];
            totalAmount += o.totalAmount || 0;
            if (o.settled) {
                settledAmount += o.totalAmount || 0;
            } else {
                unsettledAmount += (o.totalAmount || 0) - (o.paidAmount || 0);
            }
        }
        var summaryHtml = '';
        summaryHtml += '<div class="stat-card"><div class="stat-label">总金额</div><div class="stat-value">' + formatMoney(totalAmount) + '</div></div>';
        summaryHtml += '<div class="stat-card"><div class="stat-label">已结清</div><div class="stat-value" style="color:#2e7d32;">' + formatMoney(settledAmount) + '</div></div>';
        summaryHtml += '<div class="stat-card stat-card-warn"><div class="stat-label">未结清</div><div class="stat-value">' + formatMoney(unsettledAmount) + '</div></div>';
        document.getElementById('report-summary').innerHTML = summaryHtml;

        var contentHtml = '';
        if (filtered.length === 0) {
            contentHtml = '<div class="empty-tip">该时间段内没有订单</div>';
        } else {
            contentHtml += '<div class="order-list">';
            for (var j = 0; j < filtered.length; j++) {
                var ro = filtered[j];
                var sc = ro.settled ? 'settled' : 'unsettled';
                var st = ro.settled ? '已结清' : '未结清';
                contentHtml += '<div class="order-item" onclick="openOrderInCashier(' + ro.id + ')">';
                contentHtml += '<div class="order-top">';
                contentHtml += '<span class="order-customer">' + (ro.customerName || '未知') + '</span>';
                contentHtml += '<span class="order-amount">' + formatMoney(ro.totalAmount) + '</span>';
                contentHtml += '</div>';
                contentHtml += '<div class="order-info">';
                contentHtml += (ro.date || '') + '<br/>';
                if (ro.address) contentHtml += ro.address + '<br/>';
                contentHtml += (ro.summary || '');
                contentHtml += '</div>';
                contentHtml += '<span class="order-status ' + sc + '">' + st + '</span>';
                contentHtml += '</div>';
            }
            contentHtml += '</div>';
        }
        document.getElementById('report-content').innerHTML = contentHtml;
    });
}

/* ---------- 按客户查账 ---------- */

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
                    customerMap[cid] = {
                        name: o.customerName || '未知',
                        total: 0, settled: 0, unsettled: 0, count: 0
                    };
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
            list.sort(function(a, b) {
                return b.unsettled - a.unsettled;
            });

            var grandTotal = 0, grandSettled = 0, grandUnsettled = 0;
            for (var k = 0; k < list.length; k++) {
                grandTotal += list[k].total;
                grandSettled += list[k].settled;
                grandUnsettled += list[k].unsettled;
            }

            var summaryHtml = '';
            summaryHtml += '<div class="stat-card"><div class="stat-label">总金额</div><div class="stat-value">' + formatMoney(grandTotal) + '</div></div>';
            summaryHtml += '<div class="stat-card"><div class="stat-label">已结清</div><div class="stat-value" style="color:#2e7d32;">' + formatMoney(grandSettled) + '</div></div>';
            summaryHtml += '<div class="stat-card stat-card-warn"><div class="stat-label">欠款</div><div class="stat-value">' + formatMoney(grandUnsettled) + '</div></div>';
            document.getElementById('report-summary').innerHTML = summaryHtml;

            var contentHtml = '';
            if (list.length === 0) {
                contentHtml = '<div class="empty-tip">该时间段内没有订单</div>';
            } else {
                for (var m = 0; m < list.length; m++) {
                    var item = list[m];
                    contentHtml += '<div class="customer-item" onclick="showCustomerDetail(' + item.id + ')">';
                    contentHtml += '<div>';
                    contentHtml += '<div class="customer-name">' + item.name + '</div>';
                    contentHtml += '<div class="customer-phone">' + item.count + '笔订单 | 总计' + formatMoney(item.total) + '</div>';
                    contentHtml += '</div>';
                    if (item.unsettled > 0) {
                        contentHtml += '<div class="customer-debt">欠 ' + formatMoney(item.unsettled) + '</div>';
                    } else {
                        contentHtml += '<div style="color:#2e7d32;font-size:14px;">已结清</div>';
                    }
                    contentHtml += '</div>';
                }
            }
            document.getElementById('report-content').innerHTML = contentHtml;
        });
    });
}
