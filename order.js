/* ==================== 收银台 ==================== */

var cashierItems = [];
var cashierEditingOrderId = null;

// 进入收银台
function openCashier(preData) {
    cashierItems = [];
    cashierEditingOrderId = null;
    document.getElementById('cashier-settled').checked = false;
    document.getElementById('cashier-paid-amount').value = '0';
    document.getElementById('cashier-paid-section').style.display = 'block';
    document.getElementById('cashier-address').value = '';
    document.getElementById('cashier-address-history').innerHTML = '';
    document.getElementById('cashier-items').innerHTML = '';
    document.getElementById('cashier-total').textContent = '¥0.00';

    // 加载客户列表
    loadCashierCustomers(null);

    // 如果有预填数据（从聊天解析来的）
    if (preData) {
        if (preData.items && preData.items.length > 0) {
            for (var i = 0; i < preData.items.length; i++) {
                cashierItems.push(preData.items[i]);
            }
        }
        if (preData.address) {
            document.getElementById('cashier-address').value = preData.address;
        }
        if (preData.customerId) {
            setTimeout(function() {
                loadCashierCustomers(preData.customerId);
            }, 100);
        }
    }

    showPage('page-cashier');

    // 如果没有预填商品，自动添加一行空商品
    if (cashierItems.length === 0) {
        addCashierItem();
    } else {
        renderCashierItems();
    }
}

// 添加一行商品
function addCashierItem() {
    cashierItems.push({
        productId: null,
        productName: '',
        quantity: 1,
        price: 0,
        unit: ''
    });
    renderCashierItems();
}

// 删除一行商品
function removeCashierItem(index) {
    cashierItems.splice(index, 1);
    renderCashierItems();
    updateCashierTotal();
}
// 渲染商品列表
function renderCashierItems() {
    dbGetAll('products', function(products) {
        var container = document.getElementById('cashier-items');
        var html = '';

        for (var i = 0; i < cashierItems.length; i++) {
            var item = cashierItems[i];
            html += '<div class="cashier-item-row">';
            html += '  <div class="cashier-item-top">';
            html += '    <select onchange="onProductSelect(' + i + ', this.value)">';
            html += '      <option value="">选择产品</option>';
            for (var j = 0; j < products.length; j++) {
                var p = products[j];
                var sel = (item.productId === p.id) ? ' selected' : '';
                html += '      <option value="' + p.id + '"' + sel + '>' + p.name + '</option>';
            }
            html += '    </select>';
            html += '    <button class="remove-item" onclick="removeCashierItem(' + i + ')">×</button>';
            html += '  </div>';
            html += '  <div class="cashier-item-detail">';
            html += '    <span style="font-size:13px;color:#888;">数量</span>';
            html += '    <input type="number" value="' + item.quantity + '" onchange="onItemQtyChange(' + i + ', this.value)" oninput="onItemQtyChange(' + i + ', this.value)" />';
            html += '    <span style="font-size:13px;color:#888;">单价</span>';
            html += '    <input type="number" step="0.01" value="' + item.price + '" onchange="onItemPriceChange(' + i + ', this.value)" oninput="onItemPriceChange(' + i + ', this.value)" />';
            var subtotal = (item.quantity || 0) * (item.price || 0);
            html += '    <span class="item-subtotal">' + formatMoney(subtotal) + '</span>';
            html += '  </div>';
            html += '</div>';
        }

        container.innerHTML = html;
    });
}

// 选择产品时
function onProductSelect(index, productId) {
    productId = parseInt(productId);
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

        // 检查客户专属单价
        var customerId = parseInt(document.getElementById('cashier-customer').value);
        if (customerId) {
            dbGetByIndex('customerPrices', 'customerId', customerId, function(prices) {
                var specialPrice = null;
                for (var k = 0; k < prices.length; k++) {
                    if (prices[k].productId === productId) {
                        specialPrice = prices[k].price;
                        break;
                    }
                }
                cashierItems[index].price = (specialPrice !== null) ? specialPrice : (product.price || 0);
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

// 修改数量
function onItemQtyChange(index, value) {
    cashierItems[index].quantity = parseFloat(value) || 0;
    updateCashierTotal();
}

// 修改单价
function onItemPriceChange(index, value) {
    cashierItems[index].price = parseFloat(value) || 0;
    updateCashierTotal();
}

// 更新总金额
function updateCashierTotal() {
    var total = 0;
    for (var i = 0; i < cashierItems.length; i++) {
        total += (cashierItems[i].quantity || 0) * (cashierItems[i].price || 0);
    }
    document.getElementById('cashier-total').textContent = formatMoney(total);

    // 同时更新每行的小计显示
    var subtotalEls = document.querySelectorAll('.item-subtotal');
    for (var j = 0; j < subtotalEls.length; j++) {
        if (j < cashierItems.length) {
            var sub = (cashierItems[j].quantity || 0) * (cashierItems[j].price || 0);
            subtotalEls[j].textContent = formatMoney(sub);
        }
    }
}
// 保存订单
function saveOrder() {
    var customerId = parseInt(document.getElementById('cashier-customer').value);
    if (!customerId) {
        showToast('请选择客户');
        return;
    }

    // 过滤掉没选产品的行
    var validItems = cashierItems.filter(function(item) {
        return item.productId && item.quantity > 0;
    });

    if (validItems.length === 0) {
        showToast('请至少添加一个商品');
        return;
    }

    // 计算总金额
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

    // 获取客户名称快照
    dbGet('customers', customerId, function(customer) {
        var customerName = customer ? customer.name : '未知客户';

        // 生成单号
        generateOrderNo(function(orderNo) {
            var order = {
                customerId: customerId,
                customerName: customerName,
                address: address,
                totalAmount: totalAmount,
                paidAmount: paidAmount,
                settled: settled,
                date: getNowString(),
                orderNo: orderNo,
                summary: summary
            };

            // 如果是编辑模式
            if (cashierEditingOrderId) {
                order.id = cashierEditingOrderId;

                // 先删除旧的明细
                dbDeleteByIndex('orderItems', 'orderId', cashierEditingOrderId, function() {
                    dbUpdate('orders', order, function(ok) {
                        if (ok) {
                            saveOrderItems(cashierEditingOrderId, validItems, function() {
                                saveAddressIfNew(customerId, address, function() {
                                    showToast('订单已更新');
                                    goBack();
                                    refreshAfterOrderChange();
                                });
                            });
                        }
                    });
                });
            } else {
                // 新建订单
                dbAdd('orders', order, function(orderId) {
                    if (orderId) {
                        saveOrderItems(orderId, validItems, function() {
                            saveAddressIfNew(customerId, address, function() {
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

// 保存订单明细
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
    tx.oncomplete = function() {
        if (callback) callback();
    };
}

// 保存新地址
function saveAddressIfNew(customerId, address, callback) {
    if (!address) {
        if (callback) callback();
        return;
    }
    // 检查是否已存在
    dbGetByIndex('customerAddresses', 'customerId', customerId, function(addresses) {
        var exists = false;
        for (var i = 0; i < addresses.length; i++) {
            if (addresses[i].address === address) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            dbAdd('customerAddresses', {
                customerId: customerId,
                address: address
            }, function() {
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    });
}
// 打开已有订单到收银台（查看/编辑）
function openOrderInCashier(orderId) {
    dbGet('orders', orderId, function(order) {
        if (!order) {
            showToast('订单不存在');
            return;
        }

        cashierEditingOrderId = order.id;
        cashierItems = [];

        // 设置客户
        loadCashierCustomers(order.customerId);

        // 设置地址
        document.getElementById('cashier-address').value = order.address || '';

        // 设置状态
        document.getElementById('cashier-settled').checked = order.settled;
        document.getElementById('cashier-paid-section').style.display = order.settled ? 'none' : 'block';
        document.getElementById('cashier-paid-amount').value = order.paidAmount || 0;

        // 加载订单明细
        dbGetByIndex('orderItems', 'orderId', orderId, function(items) {
            for (var i = 0; i < items.length; i++) {
                cashierItems.push({
                    productId: null,
                    productName: items[i].productName,
                    quantity: items[i].quantity,
                    price: items[i].price,
                    unit: items[i].unit || ''
                });

                // 尝试匹配产品ID
                (function(idx, pName) {
                    dbGetAll('products', function(products) {
                        for (var j = 0; j < products.length; j++) {
                            if (products[j].name === pName) {
                                cashierItems[idx].productId = products[j].id;
                                break;
                            }
                        }
                        if (idx === items.length - 1) {
                            renderCashierItems();
                            updateCashierTotal();
                        }
                    });
                })(i, items[i].productName);
            }

            if (items.length === 0) {
                addCashierItem();
            }

            showPage('page-cashier');
        });
    });
}

// 删除订单
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

// 订单变更后刷新相关页面
function refreshAfterOrderChange() {
    try {
        if (typeof loadHomePage === 'function') loadHomePage();
        if (typeof loadCustomerList === 'function') loadCustomerList();
    } catch(e) {}
}
/* ==================== 首页数据加载 ==================== */

// 覆盖index.html里的占位函数
loadHomePage = function() {
    dbGetAll('orders', function(orders) {
        var today = getTodayString();
        var todayOrders = 0;
        var todayAmount = 0;
        var totalDebt = 0;

        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            // 今日订单
            if (o.date && o.date.substring(0, 10) === today) {
                todayOrders++;
                todayAmount += o.totalAmount || 0;
            }
            // 总欠款
            if (!o.settled) {
                totalDebt += (o.totalAmount || 0) - (o.paidAmount || 0);
            }
        }

        document.getElementById('home-today-orders').textContent = todayOrders;
        document.getElementById('home-today-amount').textContent = formatMoney(todayAmount);
        document.getElementById('home-total-debt').textContent = formatMoney(totalDebt);

        // 近期订单（最新20笔）
        orders.sort(function(a, b) {
            return b.date > a.date ? 1 : -1;
        });

        var recentOrders = orders.slice(0, 20);
        var container = document.getElementById('home-recent-orders');

        if (recentOrders.length === 0) {
            container.innerHTML = '<div class="empty-tip">暂无订单记录</div>';
            return;
        }

        var html = '';
        for (var j = 0; j < recentOrders.length; j++) {
            var ro = recentOrders[j];
            var statusClass = ro.settled ? 'settled' : 'unsettled';
            var statusText = ro.settled ? '已结清' : '未结清';
            html += '<div class="order-item" onclick="openOrderInCashier(' + ro.id + ')">';
            html += '  <div class="order-top">';
            html += '    <span class="order-customer">' + (ro.customerName || '未知') + '</span>';
            html += '    <span class="order-amount">' + formatMoney(ro.totalAmount) + '</span>';
            html += '  </div>';
            html += '  <div class="order-info">';
            html += '    ' + (ro.date || '') + '<br/>';
            if (ro.address) html += '    ' + ro.address + '<br/>';
            html += '    ' + (ro.summary || '');
            html += '  </div>';
            html += '  <span class="order-status ' + statusClass + '">' + statusText + '</span>';
            html += '</div>';
        }
        container.innerHTML = html;
    });
};

/* ==================== 收银台入口绑定 ==================== */

// 底部导航"记账"现在先跳到收银台（第二阶段改为聊天页）
var _origSwitchTab = switchTab;
switchTab = function(tabName) {
    if (tabName === 'chat') {
        // 第一阶段：点记账直接打开收银台
        openCashier();
        // 更新底部导航高亮
        var navItems = document.querySelectorAll('.nav-item');
        for (var i = 0; i < navItems.length; i++) {
            navItems[i].classList.remove('active');
        }
        navItems[1].classList.add('active');
        return;
    }
    _origSwitchTab(tabName);
};
