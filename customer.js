/* ================= customer.js v3.0 ================= */
/* 客户管理 + 客户详情 + 专属单价 */
/* 含：U7/U10修复、客户头像、渐变汇总卡片 */

var currentCustomerId = null;

/* ========== 加载客户列表（带头像） ========== */
function loadCustomerList(keyword) {
  dbGetAll('customers', function(customers) {
    if (keyword) {
      keyword = keyword.toLowerCase();
      customers = customers.filter(function(c) {
        return (c.name && c.name.toLowerCase().indexOf(keyword) >= 0) ||
               (c.phone && c.phone.indexOf(keyword) >= 0);
      });
    }

    var container = document.getElementById('customer-list');
    if (customers.length === 0) {
      container.innerHTML = '<div class="empty-tip">' +
        (keyword ? '没有找到匹配的客户' : '暂无客户，点右上角 + 添加') + '</div>';
      return;
    }

    dbGetAll('orders', function(orders) {
      var debtMap = {};
      var settledMap = {};

      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        if (!o.settled) {
          var cid = o.customerId;
          if (!debtMap[cid]) debtMap[cid] = 0;
          debtMap[cid] += (o.totalAmount || 0) - (o.paidAmount || 0);
            } else {
              var cid2 = o.customerId;
              if (!settledMap[cid2]) settledMap[cid2] = 0;
              settledMap[cid2] += o.totalAmount || 0;
            }
      }

      var html = '';
      for (var j = 0; j < customers.length; j++) {
        var c = customers[j];
        var debt = debtMap[c.id] || 0;
        var firstChar = (c.name || '?').substring(0, 1);

        html += '<div class="customer-item" onclick="showCustomerDetail(' + c.id + ')">';
        html += '<div class="customer-avatar">' + firstChar + '</div>';
        html += '<div class="customer-info">';
        html += '<div class="customer-name">' + c.name + '</div>';
        if (c.phone) html += '<div class="customer-phone">' + c.phone + '</div>';
        html += '</div>';
        if (debt > 0) {
          html += '<div class="customer-debt">欠 ' + formatMoney(debt) + '</div>';
            } else {
          html += '<div class="customer-debt" style="color:var(--ok)">已结清 ' + formatMoney(settledMap[c.id] || 0) + '</div>';
            }

        html += '</div>';
      }
      container.innerHTML = html;
    });
  });
}

/* ========== 搜索客户 ========== */
function searchCustomers() {
  var keyword = document.getElementById('customer-search').value.trim();
  loadCustomerList(keyword);
}

/* ========== 新增客户弹窗 ========== */
function showAddCustomer() {
  var bodyHTML =
    '<div class="form-section">' +
    '<label class="form-label">客户姓名 <span class="required">*必填</span></label>' +
    '<input type="text" class="form-input" id="customer-name-input" placeholder="输入客户姓名" />' +
    '</div>' +
    '<div class="form-section">' +
    '<label class="form-label">电话</label>' +
    '<input type="tel" class="form-input" id="customer-phone-input" placeholder="输入电话号码（可选）" />' +
    '</div>';

  showModal('新增客户', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" onclick="saveNewCustomer()">保存</button>'
  );
}

/* ========== 从收银台新增客户 ========== */
function showAddCustomerFromCashier() {
  var bodyHTML =
    '<div class="form-section">' +
    '<label class="form-label">客户姓名 <span class="required">*必填</span></label>' +
    '<input type="text" class="form-input" id="customer-name-input" placeholder="输入客户姓名" />' +
    '</div>' +
    '<div class="form-section">' +
    '<label class="form-label">电话</label>' +
    '<input type="tel" class="form-input" id="customer-phone-input" placeholder="输入电话号码（可选）" />' +
    '</div>';

  showModal('新增客户', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" onclick="saveNewCustomerFromCashier()">保存</button>'
  );
}

/* ========== 保存新客户 ========== */
function saveNewCustomer() {
  var name = document.getElementById('customer-name-input').value.trim();
  var phone = document.getElementById('customer-phone-input').value.trim();
  if (!name) { showToast('请输入客户姓名'); return; }

  dbAdd('customers', { name: name, phone: phone }, function(id) {
    if (id) {
      closeModal();
      showToast('客户添加成功');
      loadCustomerList();
    } else {
      showToast('添加失败');
    }
  });
}

/* ========== 从收银台保存新客户 ========== */
function saveNewCustomerFromCashier() {
  var name = document.getElementById('customer-name-input').value.trim();
  var phone = document.getElementById('customer-phone-input').value.trim();
  if (!name) { showToast('请输入客户姓名'); return; }

  dbAdd('customers', { name: name, phone: phone }, function(id) {
    if (id) {
      closeModal();
      showToast('客户添加成功');
      loadCashierCustomers(id);
    } else {
      showToast('添加失败');
    }
  });
}

/* ========== 客户详情（U7/U10修复 + 渐变汇总卡片） ========== */
function showCustomerDetail(customerId) {
  currentCustomerId = customerId;

  dbGet('customers', customerId, function(customer) {
    if (!customer) { showToast('客户不存在'); return; }

    document.getElementById('detail-customer-name').textContent = customer.name;

    dbGetByIndex('customerAddresses', 'customerId', customerId, function(addresses) {
      dbGetAll('orders', function(allOrders) {
        var orders = allOrders.filter(function(o) { return o.customerId === customerId; });
        orders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

        var totalAmount = 0;
        var settledAmount = 0;
        var unsettledAmount = 0;

        for (var i = 0; i < orders.length; i++) {
          totalAmount += orders[i].totalAmount || 0;
          if (orders[i].settled) {
            settledAmount += orders[i].totalAmount || 0;
          } else {
            unsettledAmount += (orders[i].totalAmount || 0) - (orders[i].paidAmount || 0);
          }
        }

        var html = '';

        // 账目汇总（渐变卡片）
html += '<div class="summary-card-gradient">';
html += '<div class="summary-row"><span class="summary-label">总金额</span><span class="summary-value">' + formatMoney(totalAmount) + '</span></div>';
if (unsettledAmount > 0) {
  html += '<div class="summary-row"><span class="summary-label">欠款</span><span class="summary-value">' + formatMoney(unsettledAmount) + '</span></div>';
} else if (orders.length > 0) {
              html += '<div class="summary-row"><span class="summary-label">已结清</span><span class="summary-value">' + formatMoney(settledAmount) + '</span></div>';
} else {
              html += '<div class="summary-row"><span class="summary-label">已结清</span><span class="summary-value">¥0.00</span></div>';
}
html += '</div>';


        // 基本信息（收纳到更多信息下拉）
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">基本信息</div>';
        html += '<div class="detail-row"><span class="label">姓名</span><span class="value">' + customer.name + '</span></div>';
        html += '<div class="detail-row"><span class="label">电话</span><span class="value">' + (customer.phone || '未填写') + '</span></div>';
        html += '</div>';

        // U7修复：专属单价直接在这里加载，不用setTimeout
        html += '<div id="price-section-box"></div>';

        // 地址
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">历史地址</div>';
        if (addresses.length === 0) {
          html += '<div style="color:#8A9BB0;font-size:14px;">暂无地址记录</div>';
        } else {
          for (var a = 0; a < addresses.length; a++) {
            html += '<div class="detail-row">';
            html += '<span class="label" style="flex:1;">' + addresses[a].address + '</span>';
            html += '<button class="btn-delete" onclick="deleteAddress(' + addresses[a].id + ')">删除</button>';
            html += '</div>';
          }
        }
        html += '</div>';

        // 订单列表
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">订单记录（' + orders.length + '笔）</div>';
        if (orders.length === 0) {
          html += '<div style="color:#8A9BB0;font-size:14px;">暂无订单</div>';
        } else {
          for (var k = 0; k < orders.length; k++) {
            var o = orders[k];
            var isRefund = o.isRefund || (o.totalAmount < 0);
            var statusClass = isRefund ? 'refund' : (o.settled ? 'settled' : 'unsettled');
            var statusText = isRefund ? '退货' : (o.settled ? '已结清' : '未结清');
            var amtClass = isRefund ? 'order-amount refund' : 'order-amount';
            var firstChar = (o.customerName || '未').substring(0, 1);
            var avatarClass = (isRefund || !o.settled) ? 'order-avatar unpaid' : 'order-avatar';

            html += '<div class="order-item" onclick="openOrderInCashier(' + o.id + ')">';
            html += '<div class="' + avatarClass + '">' + firstChar + '</div>';
            html += '<div class="order-info">';
            html += '<div class="order-top">';
            html += '<span class="order-customer">' + (o.date || '').substring(0, 10) + '</span>';
            html += '<span class="' + amtClass + '">' + formatMoney(o.totalAmount) + '</span>';
            html += '</div>';
            html += '<div class="order-meta">';
            html += '<span class="order-time">' + (o.date || '').substring(11, 16) + '</span>';
            html += '<span class="order-status ' + statusClass + '">' + statusText + '</span>';
            if (o.summary) html += '<span class="order-summary">' + o.summary + '</span>';
            html += '</div>';
            html += '</div></div>';
          }
        }
        html += '</div>';

        // 操作按钮
        html += '<div class="action-buttons">';
        html += '<button class="btn-secondary" onclick="showDeleteCustomer(' + customerId + ',\'' + customer.name.replace(/'/g, "\\'") + '\')">删除客户</button>';
        html += '<button class="btn-primary" onclick="createRefund(' + (orders.length > 0 ? orders[0].id : 0) + ')" style="background:#D4956E;">退货</button>';
        html += '</div>';

        document.getElementById('customer-detail-content').innerHTML = html;
        showPage('page-customer-detail');

        // U7修复：直接加载专属单价（不用setTimeout）
        loadCustomerPrices(customerId);
      });
    });
  });
}

/* ========== 编辑客户 ========== */
function editCurrentCustomer() {
  if (!currentCustomerId) return;

  dbGet('customers', currentCustomerId, function(customer) {
    if (!customer) return;

    var bodyHTML =
      '<div class="form-section">' +
      '<label class="form-label">客户姓名 <span class="required">*必填</span></label>' +
      '<input type="text" class="form-input" id="customer-name-input" value="' + customer.name + '" />' +
      '</div>' +
      '<div class="form-section">' +
      '<label class="form-label">电话</label>' +
      '<input type="tel" class="form-input" id="customer-phone-input" value="' + (customer.phone || '') + '" />' +
      '</div>';

    showModal('编辑客户', bodyHTML,
      '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
      '<button class="btn-primary" onclick="saveEditCustomer(' + customer.id + ')">保存</button>'
    );
  });
}

function saveEditCustomer(customerId) {
  var name = document.getElementById('customer-name-input').value.trim();
  var phone = document.getElementById('customer-phone-input').value.trim();
  if (!name) { showToast('请输入客户姓名'); return; }

  dbGet('customers', customerId, function(customer) {
    customer.name = name;
    customer.phone = phone;
    dbUpdate('customers', customer, function(ok) {
      if (ok) {
        closeModal();
        showToast('客户信息已更新');
        document.getElementById('detail-customer-name').textContent = name;
        showCustomerDetail(customerId);
      } else {
        showToast('修改失败');
      }
    });
  });
}

/* ========== 删除客户 ========== */
function showDeleteCustomer(customerId, customerName) {
  showConfirm('删除客户', '确定要删除「' + customerName + '」吗？订单记录会保留。', function() {
    dbDeleteByIndex('customerAddresses', 'customerId', customerId, function() {
      dbDeleteByIndex('customerPrices', 'customerId', customerId, function() {
        dbDelete('customers', customerId, function(ok) {
          if (ok) {
            showToast('客户已删除');
            goBack();
            loadCustomerList();
          }
        });
      });
    });
  });
}

/* ========== 删除地址 ========== */
function deleteAddress(addressId) {
  showConfirm('删除地址', '确定要删除这个地址吗？', function() {
    dbDelete('customerAddresses', addressId, function(ok) {
      if (ok) {
        showToast('地址已删除');
        showCustomerDetail(currentCustomerId);
      }
    });
  });
}

/* ========== 查看订单 ========== */
function viewOrder(orderId) {
  if (typeof openOrderInCashier === 'function') openOrderInCashier(orderId);
}

/* ========== 收银台客户下拉 ========== */
function loadCashierCustomers(selectId) {
  dbGetAll('customers', function(customers) {
    var select = document.getElementById('cashier-customer');
    var html = '<option value="">请选择客户</option>';
    for (var i = 0; i < customers.length; i++) {
      var c = customers[i];
      var selected = (selectId && c.id === selectId) ? ' selected' : '';
      html += '<option value="' + c.id + '"' + selected + '>' + c.name + (c.phone ? ' (' + c.phone + ')' : '') + '</option>';
    }
    select.innerHTML = html;
    if (selectId) loadCashierAddresses(selectId);
  });
}

/* ========== 收银台地址 ========== */
function loadCashierAddresses(customerId) {
  customerId = parseInt(customerId);
  if (!customerId) {
    document.getElementById('cashier-address-history').innerHTML = '';
    return;
  }
  dbGetByIndex('customerAddresses', 'customerId', customerId, function(addresses) {
    var container = document.getElementById('cashier-address-history');
    if (addresses.length === 0) { container.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < addresses.length; i++) {
      html += '<span class="address-tag" onclick="selectAddress(this, \'' + addresses[i].address.replace(/'/g, "\\'") + '\')">' + addresses[i].address + '</span>';
    }
    container.innerHTML = html;
  });
}

function selectAddress(el, address) {
  var tags = document.querySelectorAll('.address-tag');
  for (var i = 0; i < tags.length; i++) tags[i].classList.remove('selected');
  el.classList.add('selected');
  document.getElementById('cashier-address').value = address;
}

/* ========== 专属单价管理（U7修复：不用setTimeout） ========== */
function loadCustomerPrices(customerId) {
  var container = document.getElementById('price-section-box');
  if (!container) return;

  dbGetByIndex('customerPrices', 'customerId', customerId, function(prices) {
    dbGetAll('products', function(products) {
      var html = '<div class="detail-section">';
      html += '<div class="detail-section-title">专属单价</div>';

      if (prices.length === 0) {
        html += '<div style="color:#8A9BB0;font-size:14px;">暂无专属单价，使用默认价</div>';
      } else {
        for (var i = 0; i < prices.length; i++) {
          var pName = '未知产品';
          var defaultPrice = 0;
          for (var j = 0; j < products.length; j++) {
            if (products[j].id === prices[i].productId) {
              pName = products[j].name;
              defaultPrice = products[j].price || 0;
              break;
            }
          }
          html += '<div class="detail-row">';
          html += '<span class="label">' + pName + ' <span style="color:#8A9BB0;font-size:12px;">(默认' + formatMoney(defaultPrice) + ')</span></span>';
          html += '<span>';
          html += '<span class="value" style="color:#5BA4C8;margin-right:8px;">' + formatMoney(prices[i].price) + '</span>';
          html += '<button class="btn-delete" onclick="deleteCustomerPrice(' + prices[i].id + ',' + customerId + ')">删除</button>';
          html += '</span>';
          html += '</div>';
        }
      }

      html += '<div style="margin-top:10px;"><button class="btn-small" onclick="showAddCustomerPrice(' + customerId + ')">+ 添加专属单价</button></div>';
      html += '</div>';

      container.innerHTML = html;
    });
  });
}

function showAddCustomerPrice(customerId) {
  dbGetAll('products', function(products) {
    var opts = '';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      opts += '<option value="' + p.id + '">' + p.name + ' (默认' + formatMoney(p.price) + '/' + p.unit + ')</option>';
    }
    var bodyHTML =
      '<div class="form-section">' +
      '<label class="form-label">选择产品</label>' +
      '<select class="form-select" id="price-product-select">' + opts + '</select>' +
      '</div>' +
      '<div class="form-section">' +
      '<label class="form-label">专属单价</label>' +
      '<input type="number" step="0.01" class="form-input" id="price-value-input" placeholder="输入该客户的专属单价" />' +
      '</div>';

    showModal('添加专属单价', bodyHTML,
      '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
      '<button class="btn-primary" onclick="saveCustomerPrice(' + customerId + ')">保存</button>'
    );
  });
}

function saveCustomerPrice(customerId) {
  var productId = parseInt(document.getElementById('price-product-select').value);
  var price = parseFloat(document.getElementById('price-value-input').value);
  if (!productId || isNaN(price)) { showToast('请选择产品并输入单价'); return; }

  dbGetByIndex('customerPrices', 'customerId', customerId, function(existing) {
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].productId === productId) {
        existing[i].price = price;
        dbUpdate('customerPrices', existing[i], function() {
          closeModal();
          showToast('专属单价已更新');
          loadCustomerPrices(customerId);
        });
        return;
      }
    }
    dbAdd('customerPrices', { customerId: customerId, productId: productId, price: price }, function() {
      closeModal();
      showToast('专属单价已添加');
      loadCustomerPrices(customerId);
    });
  });
}

function deleteCustomerPrice(priceId, customerId) {
  showConfirm('删除专属单价', '确定删除这个专属单价吗？', function() {
    dbDelete('customerPrices', priceId, function(ok) {
      if (ok) {
        showToast('已删除');
        loadCustomerPrices(customerId);
      }
    });
  });
}

/* ========== 收银台客户选择变化监听 ========== */
document.addEventListener('DOMContentLoaded', function() {
  var cashierCustomer = document.getElementById('cashier-customer');
  if (cashierCustomer) {
    cashierCustomer.addEventListener('change', function() {
      var cid = parseInt(this.value);
      if (cid) {
        loadCashierAddresses(cid);
      } else {
        document.getElementById('cashier-address-history').innerHTML = '';
      }
    });
  }
});
