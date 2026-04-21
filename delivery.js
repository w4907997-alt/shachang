/* ================= delivery.js v3.0 ================= */
/* 配送单生成与显示 */
/* 含：N17模板重做、N19底部信息配置、B4修复、N10保存图片 */

/* ========== 显示配送单 ========== */
function showDeliveryNote(orderId) {
  if (!orderId) { showToast('请先保存订单'); return; }

  dbGet('orders', orderId, function(order) {
    if (!order) { showToast('订单不存在'); return; }

    dbGetByIndex('orderItems', 'orderId', orderId, function(items) {
      // 读取配送单设置（N19）
      loadDeliverySettings(function(settings) {
        var title = (settings.title || '配 送 单').replace(/\s+/g, '');
        var displayTitle = title.split('').join('  '); // 字间距效果

        var html = '<div class="delivery-note" id="delivery-note-content">';

        // 标题 + 单号
        html += '<div class="delivery-title">' + displayTitle + '</div>';
        html += '<div class="delivery-no">NO.' + (order.orderNo || '0000001') + '</div>';

        // 客户 + 日期
        html += '<div class="delivery-info-row">';
        html += '<span>客户名称：' + (order.customerName || '——') + '</span>';
        html += '</div>';
        html += '<div class="delivery-info-row">';
        var dateStr = (order.date || '').substring(0, 10);
        var dateParts = dateStr.split('-');
        html += '<span>日期：' + (dateParts[0] || '____') + '年' + (dateParts[1] || '__') + '月' + (dateParts[2] || '__') + '日</span>';
        html += '</div>';

        // 商品表格（含单位列）
        html += '<table class="delivery-table">';
        html += '<thead><tr>';
        html += '<th>商品名称</th><th>数量</th><th>单位</th><th>单价</th><th>金额</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var sub = (it.quantity || 0) * (it.price || 0);
          html += '<tr>';
          html += '<td style="text-align:left;">' + it.productName + '</td>';
          html += '<td>' + it.quantity + '</td>';
          html += '<td>' + (it.unit || '') + '</td>';
          html += '<td>' + (it.price || 0).toFixed(2) + '</td>';
          html += '<td>' + sub.toFixed(2) + '</td>';
          html += '</tr>';
        }

        // 空行填充（至少显示6行）
        var emptyRows = Math.max(0, 6 - items.length);
        for (var e = 0; e < emptyRows; e++) {
          html += '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>';
        }

        html += '</tbody></table>';

        // 合计金额
        html += '<div class="delivery-total-row">';
        html += '<span>合计人民币（大写）</span>';
        html += '<span>¥ ' + (order.totalAmount || 0).toFixed(2) + '</span>';
        html += '</div>';

        // 大写金额
        html += '<div class="delivery-chinese">' + moneyToChinese(order.totalAmount || 0) + '</div>';

        // 状态
        var statusText = order.settled ? '已结清' : '未结清（欠 ¥' + ((order.totalAmount || 0) - (order.paidAmount || 0)).toFixed(2) + '）';
        var statusCls = order.settled ? 'settled' : 'unsettled';
        html += '<div style="margin-top:8px;">状态：<span class="delivery-status ' + statusCls + '">' + statusText + '</span></div>';

        // 底部信息（N19）
        html += '<div class="delivery-footer">';
        if (order.address) html += '送货地址：' + order.address + '<br/>';
        if (settings.phone) html += '订货电话：' + settings.phone + '<br/>';
        if (settings.bank) html += '银行：' + settings.bank + '<br/>';
        if (settings.extra) html += settings.extra + '<br/>';
        html += '</div>';

        html += '</div>';

        // 底部按钮
        var footerHTML =
          '<button class="btn-secondary" onclick="closeModal()">关闭</button>' +
          '<button class="btn-primary" onclick="saveDeliveryImage()">保存图片</button>';

        showModal('配送单', html, footerHTML);
      });
    });
  });
}

/* ========== N19：加载配送单设置 ========== */
function loadDeliverySettings(callback) {
  var settings = { title: '', phone: '', bank: '', extra: '' };

  if (!db) { callback(settings); return; }

  var keys = ['deliveryTitle', 'deliveryPhone', 'deliveryBank', 'deliveryExtra'];
  var done = 0;

  for (var i = 0; i < keys.length; i++) {
    (function(key) {
      dbGet('systemConfig', key, function(record) {
        if (record && record.value) {
          if (key === 'deliveryTitle') settings.title = record.value;
          if (key === 'deliveryPhone') settings.phone = record.value;
          if (key === 'deliveryBank') settings.bank = record.value;
          if (key === 'deliveryExtra') settings.extra = record.value;
        }
        done++;
        if (done === keys.length) callback(settings);
      });
    })(keys[i]);
  }
}

/* ========== N19：保存配送单设置 ========== */
function saveDeliverySettings() {
  var title = document.getElementById('delivery-set-title').value.trim();
  var phone = document.getElementById('delivery-set-phone').value.trim();
  var bank = document.getElementById('delivery-set-bank').value.trim();
  var extra = document.getElementById('delivery-set-extra').value.trim();

  var items = [
    { key: 'deliveryTitle', value: title },
    { key: 'deliveryPhone', value: phone },
    { key: 'deliveryBank', value: bank },
    { key: 'deliveryExtra', value: extra }
  ];

  var done = 0;
  for (var i = 0; i < items.length; i++) {
    dbUpdate('systemConfig', items[i], function() {
      done++;
      if (done === items.length) {
        showToast('配送单设置已保存');
      }
    });
  }
}

/* ========== N19：加载配送单设置页面数据 ========== */
function loadDeliverySettingsPage() {
  loadDeliverySettings(function(settings) {
    var titleInput = document.getElementById('delivery-set-title');
    var phoneInput = document.getElementById('delivery-set-phone');
    var bankInput = document.getElementById('delivery-set-bank');
    var extraInput = document.getElementById('delivery-set-extra');

    if (titleInput) titleInput.value = settings.title || '';
    if (phoneInput) phoneInput.value = settings.phone || '';
    if (bankInput) bankInput.value = settings.bank || '';
    if (extraInput) extraInput.value = settings.extra || '';
  });
}

/* ========== N10：保存配送单为图片 ========== */
function saveDeliveryImage() {
  var element = document.getElementById('delivery-note-content');
  if (!element) { showToast('找不到配送单内容'); return; }

  if (typeof html2canvas === 'undefined') {
    showToast('图片组件未加载，请稍后重试');
    return;
  }

  html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true
  }).then(function(canvas) {
    var link = document.createElement('a');
    link.download = '配送单_' + getTodayString() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('图片已保存');
  }).catch(function(err) {
    showToast('保存失败：' + err.message);
  });
}

/* ========== 页面切换时加载设置 ========== */
document.addEventListener('DOMContentLoaded', function() {
  // 拦截showPage，进入配送单设置页时加载数据
  var _origShowPage2 = showPage;
  showPage = function(pageId) {
    _origShowPage2(pageId);
    if (pageId === 'page-delivery-settings') {
      loadDeliverySettingsPage();
    }
  };
});
