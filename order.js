/* ================= order.js v3.0 ================= */
/* 收银台 + 首页数据加载 */
/* 含：N1开单日期、N3新商品、N7退货、B9/B10修复 */

var cashierItems = [];
var cashierEditingOrderId = null;
var cashierOriginalDate = null;

/* ========== 打开收银台 ========== */
function openCashier(preData) {
  cashierItems = [];
  cashierEditingOrderId = null;
  cashierOriginalDate = null;

  document.getElementById('cashier-settled').checked = false;
  document.getElementById('cashier-paid-amount').value = '0';
  document.getElementById('cashier-paid-section').style.display = 'block';
  document.getElementById('cashier-address').value = '';
  document.getElementById('cashier-address-history').innerHTML = '';
  document.getElementById('cashier-items').innerHTML = '';
  document.getElementById('cashier-total').textContent = '¥0.00';

  // N1：默认今天日期
  document.getElementById('cashier-order-date').value = getTodayString();

  // 配送单按钮默认隐藏（编辑已有订单时才显示）
  var deliveryBtn = document.getElementById('cashier-delivery-btn');
  if (deliveryBtn) deliveryBtn.style.display = 'none';

  loadCashierCustomers(null);

  if (preData) {
    if (preData.items && preData.items.length > 0) {
      for (var i = 0; i < preData.items.length; i++) cashierItems.push(preData.items[i]);
    }
    if (preData.address) document.getElementById('cashier-address').value = preData.address;
    if (preData.customerId) setTimeout(function() { loadCashierCustomers(preData.customerId); }, 100);
  }

  showPage('page-cashier');
  if (cashierItems.length === 0) addCashierItem();
  else renderCashierItems();
}

/* ========== 添加商品行 ========== */
function addCashierItem() {
  cashierItems.push({ productId: null, productName: '', quantity: 1, price: 0, unit: '' });
  renderCashierItems();
}

/* ========== 删除商品行 ========== */
function removeCashierItem(index) {
  cashierItems.splice(index, 1);
  renderCashierItems();
  updateCashierTotal();
}

/* ========== 渲染商品列表（N3：加【其他】选项） ========== */
function renderCashierItems() {
  dbGetAll('products', function(products) {
    var container = document.getElementById('cashier-items');
    var html = '';
    for (var i = 0; i < cashierItems.length; i++) {
      var item = cashierItems[i];
      var isCustom = (item.productName === '【自定义】' || (item.productId === null && item.productName && item.productName !== ''));

      html += '<div class="cashier-item-row">';
      html += '<div class="cashier-item-top">';
      html += '<select onchange="onProductSelect(' + i + ',this.value)">';
      html += '<option value="">选择产品</option>';

      for (var j = 0; j < products.length; j++) {
        var p = products[j];
        var sel = (item.productId === p.id) ? ' selected' : '';
        html += '<option value="' + p.id + '"' + sel + '>' + p.name + '</option>';
      }

      // N3：其他/自定义选项
      var customSel = (item.productId === -1) ? ' selected' : '';
      html += '<option value="-1"' + customSel + '>【其他】手动输入</option>';
      html += '</select>';
      html += '<button class="remove-item" onclick="removeCashierItem(' + i + ')">×</button>';
      html += '</div>';

      // 如果选了【其他】，显示商品名输入框
      if (item.productId === -1) {
        html += '<div style="margin-bottom:8px;">';
        html += '<input type="text" class="form-input" placeholder="输入商品名称" value="' + (item.productName || '') + '" onchange="onCustomProductName(' + i + ',this.value)" style="margin-bottom:6px;" />';
        html += '</div>';
      }

      html += '<div class="cashier-item-detail">';
      html += '<span>数量</span>';
      html += '<input type="number" value="' + item.quantity + '" onchange="onItemQtyChange(' + i + ',this.value)" oninput="onItemQtyChange(' + i + ',this.value)" />';
      html += '<span>单价</span>';
      html += '<input type="number" step="0.01" value="' + item.price + '" onchange="onItemPriceChange(' + i + ',this.value)" oninput="onItemPriceChange(' + i + ',this.value)" />';
      var sub = (item.quantity || 0) * (item.price || 0);
      html += '<span class="item-subtotal">' + formatMoney(sub) + '</span>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  });
}

/* ========== N3：自定义商品名称 ========== */
function onCustomProductName(index, name) {
  cashierItems[index].productName = name;
}

/* ========== 选择产品 ========== */
function onProductSelect(index, productId) {
  productId = parseInt(productId);

  // N3：选了【其他】
  if (productId === -1) {
    cashierItems[index].productId = -1;
    cashierItems[index].productName = '';
    cashierItems[index].price = 0;
    cashierItems[index].unit = '项';
    renderCashierItems();
    updateCashierTotal();
    return;
  }

  if (!productId) {
    cashierItems[index].productId = null;
    cashierItems[index].productName = '';
    cashierItems[index].price = 0;
    cashierItems[index].unit = '';
    renderCashierItems();
    updateCashierTotal();
    return;
  }

  dbGet('products', productId, function(product) {
    if (!product) return;
    cashierItems[index].productId = product.id;
    cashierItems[index].productName = product.name;
    cashierItems[index].unit = product.unit || '';

    var cid = parseInt(document.getElementById('cashier-customer').value);
    if (cid) {
      dbGetByIndex('customerPrices', 'customerId', cid, function(prices) {
        var sp = null;
        for (var k = 0; k < prices.length; k++) {
          if (prices[k].productId === productId) { sp = prices[k].price; break; }
        }
        cashierItems[index].price = (sp !== null) ? sp : (product.price || 0);
        renderCashierItems();
        updateCashierTotal();
      });
    } else {
      cashierItems[index].price = product.price || 0;
      renderCashierItems();
      updateCashierTotal();
    }
  });
}

function onItemQtyChange(index, value) {
  cashierItems[index].quantity = parseFloat(value) || 0;
  updateCashierTotal();
}

function onItemPriceChange(index, value) {
  cashierItems[index].price = parseFloat(value) || 0;
  updateCashierTotal();
}

/* ========== 更新总金额 ========== */
function updateCashierTotal() {
  var total = 0;
  for (var i = 0; i < cashierItems.length; i++) {
    total += (cashierItems[i].quantity || 0) * (cashierItems[i].price || 0);
  }
  document.getElementById('cashier-total').textContent = formatMoney(total);

  var els = document.querySelectorAll('.item-subtotal');
  for (var j = 0; j < els.length; j++) {
    if (j < cashierItems.length) {
      var s = (cashierItems[j].quantity || 0) * (cashierItems[j].price || 0);
      els[j].textContent = formatMoney(s);
    }
  }
}

/* ========== 保存订单（B10修复） ========== */
function saveOrder() {
  var customerId = parseInt(document.getElementById('cashier-customer').value);
  if (!customerId) { showToast('请选择客户'); return; }

  var validItems = cashierItems.filter(function(item) {
    // N3：自定义商品需要有名称
    if (item.productId === -1) return item.productName && item.quantity > 0;
    return item.productId && item.quantity > 0;
  });
  if (validItems.length === 0) { showToast('请至少添加一个商品'); return; }

  var totalAmount = 0;
  var summaryParts = [];
  for (var i = 0; i < validItems.length; i++) {
    var sub = (validItems[i].quantity || 0) * (validItems[i].price || 0);
    totalAmount += sub;
    summaryParts.push(validItems[i].productName + '×' + validItems[i].quantity);
  }
  var summary = summaryParts.join('、');

  var settled = document.getElementById('cashier-settled').checked;
  var paidAmount = settled ? totalAmount : (parseFloat(document.getElementById('cashier-paid-amount').value) || 0);
  var address = document.getElementById('cashier-address').value.trim();

  // N1：获取开单日期
  var orderDate = document.getElementById('cashier-order-date').value;
  if (!orderDate) orderDate = getTodayString();

  dbGet('customers', customerId, function(customer) {
    var customerName = customer ? customer.name : '未知客户';

    generateOrderNo(function(orderNo) {
      // B10修复：开单时间用选择的日期 + 当前时分
      var now = new Date();
      var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var fullDate = orderDate + ' ' + timeStr;

      var order = {
        customerId: customerId,
        customerName: customerName,
        address: address,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        settled: settled,
        // B10：编辑时保留原始开单日期，结清时间单独记录
        date: cashierEditingOrderId ? (orderDate + ' ' + (cashierOriginalDate || '').substring(11, 16)) : fullDate,
        orderNo: orderNo,
        summary: summary
      };

      // B10：如果是编辑且标记结清，记录结清时间
      if (settled && cashierEditingOrderId) {
        order.settledDate = getNowString();
      }

      if (cashierEditingOrderId) {
        order.id = cashierEditingOrderId;
        dbDeleteByIndex('orderItems', 'orderId', cashierEditingOrderId, function() {
          dbUpdate('orders', order, function(ok) {
            if (ok) {
              saveOrderItems(cashierEditingOrderId, validItems, function() {
                saveAddressIfNew(customerId, address, function() {
                  window._orderSavedOK = true;
                  showToast('订单已更新');
                  goBack();
                  refreshAfterOrderChange();
                });
              });
            }
          });
        });
      } else {
        dbAdd('orders', order, function(orderId) {
          if (orderId) {
            saveOrderItems(orderId, validItems, function() {
              saveAddressIfNew(customerId, address, function() {
                window._orderSavedOK = true;
                showToast('订单已保存 ' + formatMoney(totalAmount));
                goBack();
                refreshAfterOrderChange();
              });
            });
          } else {
            showToast('保存失败');
          }
        });
      }
    });
  });
}

/* ========== 保存订单明细 ========== */
function saveOrderItems(orderId, items, callback) {
  var tx = db.transaction('orderItems', 'readwrite');
  var store = tx.objectStore('orderItems');
  for (var i = 0; i < items.length; i++) {
    store.add({
      orderId: orderId,
      productName: items[i].productName,
      quantity: items[i].quantity,
      price: items[i].price,
      unit: items[i].unit || '',
      subtotal: (items[i].quantity || 0) * (items[i].price || 0)
    });
  }
  tx.oncomplete = function() { if (callback) callback(); };
}

/* ========== 保存新地址 ========== */
function saveAddressIfNew(customerId, address, callback) {
  if (!address) { if (callback) callback(); return; }
  dbGetByIndex('customerAddresses', 'customerId', customerId, function(addrs) {
    var exists = false;
    for (var i = 0; i < addrs.length; i++) {
      if (addrs[i].address === address) { exists = true; break; }
    }
    if (!exists) {
      dbAdd('customerAddresses', { customerId: customerId, address: address }, function() {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  });
}

/* ========== 打开已有订单编辑 ========== */
function openOrderInCashier(orderId) {
  dbGet('orders', orderId, function(order) {
    if (!order) { showToast('订单不存在'); return; }

    cashierEditingOrderId = order.id;
    cashierItems = [];
    cashierOriginalDate = order.date; // B10：保存原始日期

    loadCashierCustomers(order.customerId);
    document.getElementById('cashier-address').value = order.address || '';
    document.getElementById('cashier-settled').checked = order.settled;
    document.getElementById('cashier-paid-section').style.display = order.settled ? 'none' : 'block';
    document.getElementById('cashier-paid-amount').value = order.paidAmount || 0;

    // N1：回填开单日期
    var dateOnly = (order.date || '').substring(0, 10);
    document.getElementById('cashier-order-date').value = dateOnly || getTodayString();

    // 显示配送单按钮
    var deliveryBtn = document.getElementById('cashier-delivery-btn');
    if (deliveryBtn) {
      deliveryBtn.style.display = 'block';
      deliveryBtn.onclick = function() { showDeliveryNote(orderId); };
    }

    dbGetByIndex('orderItems', 'orderId', orderId, function(items) {
      if (items.length === 0) {
        addCashierItem();
        showPage('page-cashier');
        return;
      }

      dbGetAll('products', function(products) {
        for (var i = 0; i < items.length; i++) {
          var pid = null;
          for (var j = 0; j < products.length; j++) {
            if (products[j].name === items[i].productName) {
              pid = products[j].id;
              break;
            }
          }
          cashierItems.push({
            productId: pid,
            productName: items[i].productName,
            quantity: items[i].quantity,
            price: items[i].price,
            unit: items[i].unit || ''
          });
        }
        renderCashierItems();
        updateCashierTotal();
        showPage('page-cashier');
      });
    });
  });
}

/* ========== 删除订单 ========== */
function deleteOrder(orderId) {
  showConfirm('删除订单', '确定要删除这张订单吗？此操作不可撤销。', function() {
    dbDeleteByIndex('orderItems', 'orderId', orderId, function() {
      dbDelete('orders', orderId, function(ok) {
        if (ok) {
          showToast('订单已删除');
          goBack();
          refreshAfterOrderChange();
        }
      });
    });
  });
}

/* ========== N7：退货功能 ========== */
function createRefund(originalOrderId) {
  dbGet('orders', originalOrderId, function(order) {
    if (!order) { showToast('原订单不存在'); return; }

    dbGetByIndex('orderItems', 'orderId', originalOrderId, function(items) {
      if (items.length === 0) { showToast('原订单没有商品'); return; }

      // 弹窗选择退货商品和数量
      var bodyHTML = '<div style="margin-bottom:12px;font-size:14px;color:#8A9BB0;">选择要退货的商品和数量：</div>';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        bodyHTML += '<div class="detail-row" style="padding:10px 0;">';
        bodyHTML += '<div style="flex:1;">';
        bodyHTML += '<div style="font-weight:500;">' + it.productName + '</div>';
        bodyHTML += '<div style="font-size:12px;color:#8A9BB0;">原数量：' + it.quantity + ' ' + (it.unit || '') + ' | 单价：' + formatMoney(it.price) + '</div>';
        bodyHTML += '</div>';
        bodyHTML += '<input type="number" id="refund-qty-' + i + '" value="0" min="0" max="' + it.quantity + '" style="width:60px;padding:8px;background:#F4F8FB;border:none;border-radius:8px;text-align:center;font-size:14px;" />';
        bodyHTML += '</div>';
      }

      showModal('退货', bodyHTML,
        '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
        '<button class="btn-primary" onclick="doRefund(' + originalOrderId + ')">确认退货</button>'
      );

      // 存一下items供doRefund用
      window._refundItems = items;
    });
  });
}

function doRefund(originalOrderId) {
  var items = window._refundItems;
  if (!items) return;

  var refundItems = [];
  for (var i = 0; i < items.length; i++) {
    var qty = parseFloat(document.getElementById('refund-qty-' + i).value) || 0;
    if (qty > 0) {
      refundItems.push({
        productName: items[i].productName,
        quantity: qty,
        price: items[i].price,
        unit: items[i].unit || '',
        subtotal: qty * items[i].price
      });
    }
  }

  if (refundItems.length === 0) {
    showToast('请选择退货商品和数量');
    return;
  }

  dbGet('orders', originalOrderId, function(order) {
    var refundTotal = 0;
    var summaryParts = [];
    for (var j = 0; j < refundItems.length; j++) {
      refundTotal += refundItems[j].subtotal;
      summaryParts.push(refundItems[j].productName + '×' + refundItems[j].quantity);
    }

    generateOrderNo(function(orderNo) {
      var refundOrder = {
        customerId: order.customerId,
        customerName: order.customerName,
        address: order.address,
        totalAmount: -refundTotal,
        paidAmount: 0,
        settled: true,
        date: getNowString(),
        orderNo: orderNo,
        summary: '【退货】' + summaryParts.join('、'),
        isRefund: true,
        originalOrderId: originalOrderId
      };

      dbAdd('orders', refundOrder, function(refundOrderId) {
        if (refundOrderId) {
          // 保存退货明细（数量为负）
          var tx = db.transaction('orderItems', 'readwrite');
          var store = tx.objectStore('orderItems');
          for (var k = 0; k < refundItems.length; k++) {
            store.add({
              orderId: refundOrderId,
              productName: refundItems[k].productName,
              quantity: -refundItems[k].quantity,
              price: refundItems[k].price,
              unit: refundItems[k].unit,
              subtotal: -refundItems[k].subtotal
            });
          }
          tx.oncomplete = function() {
            closeModal();
            showToast('退货订单已生成，金额 -' + formatMoney(refundTotal));
            refreshAfterOrderChange();
          };
        }
      });
    });
  });
}

/* ========== B9：优化刷新 ========== */
function refreshAfterOrderChange() {
  try {
    if (typeof loadHomePage === 'function') loadHomePage();
  } catch(e) {}
}

/* ========== 首页数据加载（新UI模板） ========== */
document.addEventListener('DOMContentLoaded', function() {
  loadHomePage = function() {
    dbGetAll('orders', function(orders) {
      var today = getTodayString();
      var todayOrders = 0, todayAmount = 0, totalDebt = 0;

      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        if (o.date && o.date.substring(0, 10) === today) {
          todayOrders++;
          todayAmount += o.totalAmount || 0;
        }
        if (!o.settled) {
          totalDebt += (o.totalAmount || 0) - (o.paidAmount || 0);
        }
      }

      var badge = document.getElementById('home-today-badge');
      var amount = document.getElementById('home-today-amount');
      var debt = document.getElementById('home-total-debt');
      if (badge) badge.textContent = '今日 ' + todayOrders + ' 笔';
      if (amount) amount.textContent = formatMoney(todayAmount);
      if (debt) debt.textContent = formatMoney(totalDebt);

      // 按日期倒序
      orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
      var recent = orders.slice(0, 20);

      var box = document.getElementById('home-recent-orders');
      if (recent.length === 0) {
        box.innerHTML = '<div class="empty-tip">暂无订单记录</div>';
        return;
      }

      var html = '';
      var lastDateLabel = '';

      for (var j = 0; j < recent.length; j++) {
        var ro = recent[j];
        var dateStr = (ro.date || '').substring(0, 10);
        var dateLabel = (dateStr === today) ? '今天' : dateStr.substring(5);

        if (dateLabel !== lastDateLabel) {
          html += '<div class="date-divider">' + dateLabel + '</div>';
          lastDateLabel = dateLabel;
        }

        var isRefund = ro.isRefund || (ro.totalAmount < 0);
        var avatarCls = 'order-avatar';
        var amtCls = 'order-amount';
        var statusCls = 'order-status';
        var statusText = '';

        if (isRefund) {
          avatarCls += ' unpaid';
          amtCls += ' refund';
          statusCls += ' refund';
          statusText = '退货';
        } else if (ro.settled) {
          statusCls += ' settled';
          statusText = '已结清';
        } else {
          avatarCls += ' unpaid';
          amtCls += ' unpaid';
          statusCls += ' unsettled';
          statusText = '未结清';
        }

        var firstChar = (ro.customerName || '未').substring(0, 1);
        var timeStr = (ro.date || '').substring(11, 16);

        html += '<div class="order-item" onclick="openOrderInCashier(' + ro.id + ')">';
        html += '<div class="' + avatarCls + '">' + firstChar + '</div>';
        html += '<div class="order-info">';
        html += '<div class="order-top">';
        html += '<span class="order-customer">' + (ro.customerName || '未知') + '</span>';
        html += '<span class="' + amtCls + '">' + formatMoney(ro.totalAmount) + '</span>';
        html += '</div>';
        html += '<div class="order-meta">';
        html += '<span class="order-time">' + timeStr + '</span>';
        html += '<span class="' + statusCls + '">' + statusText + '</span>';
        if (ro.summary) html += '<span class="order-summary">' + ro.summary + '</span>';
        html += '</div>';
        html += '</div></div>';
      }

      box.innerHTML = html;
    });
  };

  try { if (db) loadHomePage(); } catch(e) {}
});
