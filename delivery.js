/* ================= delivery.js ================= */
/* 配送单生成与展示 */

function showDeliveryNote(orderId) {
    dbGet('orders', orderId, function(order) {
        if (!order) { showToast('订单不存在'); return; }

        dbGetByIndex('orderItems', 'orderId', orderId, function(items) {
            var html = '<div style="padding:4px 0;">';

            // 标题
            html += '<div style="text-align:center;margin-bottom:16px;">';
            html += '<h2 style="margin:0;font-size:20px;">配 送 单</h2>';
            html += '<div style="color:#888;font-size:13px;margin-top:4px;">单号：' + (order.orderNo || '--') + '</div>';
            html += '<div style="color:#888;font-size:13px;">' + (order.date || '') + '</div>';
            html += '</div>';

            // 客户信息
            html += '<div style="margin-bottom:12px;font-size:15px;">';
            html += '<div><b>客户：</b>' + (order.customerName || '--') + '</div>';
            if (order.address) html += '<div><b>地址：</b>' + order.address + '</div>';
            html += '</div>';

            // 商品表格
            html += '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px;">';
            html += '<tr style="background:#f5f5f5;">';
            html += '<th style="border:1px solid #ddd;padding:8px;text-align:left;">商品</th>';
            html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">数量</th>';
            html += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">单价</th>';
            html += '<th style="border:1px solid #ddd;padding:8px;text-align:right;">金额</th>';
            html += '</tr>';
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var sub = (it.quantity || 0) * (it.price || 0);
                html += '<tr>';
                html += '<td style="border:1px solid #ddd;padding:8px;">' + it.productName + '</td>';
                html += '<td style="border:1px solid #ddd;padding:8px;text-align:center;">' + it.quantity + (it.unit || '') + '</td>';
                html += '<td style="border:1px solid #ddd;padding:8px;text-align:center;">' + formatMoney(it.price) + '</td>';
                html += '<td style="border:1px solid #ddd;padding:8px;text-align:right;">' + formatMoney(sub) + '</td>';
                html += '</tr>';
            }
            html += '</table>';

            // 金额
            html += '<div style="text-align:right;font-size:16px;margin-bottom:4px;">';
            html += '<b>总金额：</b><span style="color:#e53935;font-size:20px;font-weight:700;">' + formatMoney(order.totalAmount) + '</span>';
            html += '</div>';
            html += '<div style="text-align:right;font-size:13px;color:#888;margin-bottom:16px;">';
            html += '大写：' + moneyToChinese(order.totalAmount);
            html += '</div>';

            // 状态
            var statusText = order.settled ? '已结清' : '未结清（欠 ' + formatMoney((order.totalAmount || 0) - (order.paidAmount || 0)) + '）';
            html += '<div style="font-size:14px;color:#666;">状态：' + statusText + '</div>';
            html += '</div>';

            showModal('配送单', html,
                '<button class="btn-secondary" onclick="closeModal()">关闭</button>'
            );
        });
    });
}

/* ---------- 在订单保存后提供配送单入口 ---------- */

document.addEventListener('DOMContentLoaded', function() {
    var origOpenOrder = openOrderInCashier;
    openOrderInCashier = function(orderId) {
        origOpenOrder(orderId);
        setTimeout(function() {
            var actionDiv = document.querySelector('#page-cashier .action-buttons');
            if (actionDiv && !document.getElementById('delivery-btn')) {
                var btn = document.createElement('button');
                btn.id = 'delivery-btn';
                btn.className = 'btn-small';
                btn.textContent = '配送单';
                btn.style.cssText = 'position:absolute;right:12px;top:58px;';
                btn.onclick = function() { showDeliveryNote(orderId); };
                var header = document.querySelector('#page-cashier .page-header');
                if (header) {
                    header.style.position = 'relative';
                    header.appendChild(btn);
                }
            }
        }, 300);
    };
});
