/* ================= product.js v3.0 ================= */
/* 产品管理 + 简称映射配置 */

/* ========== 加载产品列表 ========== */
function loadProductList() {
  if (!db) { setTimeout(loadProductList, 300); return; }

  dbGetAll('products', function(products) {
    var container = document.getElementById('product-list');
    if (products.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无产品，点右上角 + 添加</div>';
      return;
    }

    products.sort(function(a, b) {
      return (a.sortOrder || 999) - (b.sortOrder || 999);
    });

    var html = '';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var priceText = p.price > 0 ? formatMoney(p.price) + '/' + p.unit : '手动输入';
      html += '<div class="product-item">';
      html += '<div>';
      html += '<div class="product-name">' + p.name + '</div>';
      html += '<div class="product-info">' + priceText + '</div>';
      html += '</div>';
      html += '<div class="product-actions">';
      html += '<button onclick="showEditProduct(' + p.id + ')">编辑</button>';
      html += '<button class="btn-delete" onclick="deleteProduct(' + p.id + ', \'' + p.name.replace(/'/g, "\\'") + '\')">删除</button>';
      html += '</div>';
      html += '</div>';
    }

    // 简称映射配置入口
    html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #E8EFF5;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<span style="font-size:15px;font-weight:600;color:#1A2634;">简称映射</span>';
    html += '<button class="btn-small" onclick="showAliasManager()">管理</button>';
    html += '</div>';
    html += '<div style="font-size:12px;color:#8A9BB0;line-height:1.6;">输入简称自动替换为全名<br/>例如：输入「沙20」自动识别为「黄沙×20」</div>';
    html += '</div>';

    container.innerHTML = html;
  });
}

/* ========== 新增产品 ========== */
function showAddProduct() {
  var bodyHTML =
    '<div class="form-section">' +
    '<label class="form-label">产品名称 <span class="required">*必填</span></label>' +
    '<input type="text" class="form-input" id="product-name-input" placeholder="输入产品名称" />' +
    '</div>' +
    '<div class="form-section">' +
    '<label class="form-label">单位</label>' +
    '<input type="text" class="form-input" id="product-unit-input" placeholder="如：袋、块、根" />' +
    '</div>' +
    '<div class="form-section">' +
    '<label class="form-label">默认单价</label>' +
    '<input type="number" class="form-input" id="product-price-input" placeholder="输入默认单价" />' +
    '</div>';

  showModal('新增产品', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" onclick="saveNewProduct()">保存</button>'
  );
}

function saveNewProduct() {
  var name = document.getElementById('product-name-input').value.trim();
  var unit = document.getElementById('product-unit-input').value.trim();
  var price = parseFloat(document.getElementById('product-price-input').value) || 0;
  if (!name) { showToast('请输入产品名称'); return; }

  dbGetAll('products', function(products) {
    var maxSort = 0;
    for (var i = 0; i < products.length; i++) {
      if ((products[i].sortOrder || 0) > maxSort && products[i].sortOrder < 99) {
        maxSort = products[i].sortOrder;
      }
    }
    dbAdd('products', { name: name, unit: unit || '个', price: price, sortOrder: maxSort + 1 }, function(id) {
      if (id) {
        closeModal();
        showToast('产品添加成功');
        loadProductList();
      } else {
        showToast('添加失败');
      }
    });
  });
}

/* ========== 编辑产品 ========== */
function showEditProduct(productId) {
  dbGet('products', productId, function(product) {
    if (!product) { showToast('产品不存在'); return; }

    var bodyHTML =
      '<div class="form-section">' +
      '<label class="form-label">产品名称 <span class="required">*必填</span></label>' +
      '<input type="text" class="form-input" id="product-name-input" value="' + product.name + '" />' +
      '</div>' +
      '<div class="form-section">' +
      '<label class="form-label">单位</label>' +
      '<input type="text" class="form-input" id="product-unit-input" value="' + (product.unit || '') + '" />' +
      '</div>' +
      '<div class="form-section">' +
      '<label class="form-label">默认单价</label>' +
      '<input type="number" class="form-input" id="product-price-input" value="' + (product.price || '') + '" />' +
      '</div>';

    showModal('编辑产品', bodyHTML,
      '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
      '<button class="btn-primary" onclick="saveEditProduct(' + product.id + ')">保存</button>'
    );
  });
}

function saveEditProduct(productId) {
  var name = document.getElementById('product-name-input').value.trim();
  var unit = document.getElementById('product-unit-input').value.trim();
  var price = parseFloat(document.getElementById('product-price-input').value) || 0;
  if (!name) { showToast('请输入产品名称'); return; }

  dbGet('products', productId, function(product) {
    product.name = name;
    product.unit = unit || '个';
    product.price = price;
    dbUpdate('products', product, function(ok) {
      if (ok) {
        closeModal();
        showToast('产品修改成功');
        loadProductList();
      } else {
        showToast('修改失败');
      }
    });
  });
}

/* ========== 删除产品 ========== */
function deleteProduct(productId, productName) {
  showConfirm('删除产品', '确定要删除「' + productName + '」吗？删除后不影响历史订单。', function() {
    dbDelete('products', productId, function(ok) {
      if (ok) {
        showToast('已删除');
        loadProductList();
      } else {
        showToast('删除失败');
      }
    });
  });
}

/* ========== 简称映射管理 ========== */
function showAliasManager() {
  // 内置映射
  var builtIn = {
    '沙': '黄沙', '砂': '黄沙', '泥': '水泥', '砖': '小砖',
    '网': '钢网', '桥': '1.2过桥', '小桥': '1.2过桥', '过伙': '1.2过桥',
    '大桥': '1.5过桥', '陶': '陶粒', '粒': '陶粒', '大砖': '75大砖',
    '搬运': '水泥4楼搬运费'
  };

  // 加载自定义映射
  dbGet('systemConfig', 'customAliases', function(record) {
    var custom = {};
    if (record && record.value) {
      try { custom = JSON.parse(record.value); } catch(e) {}
    }

    var bodyHTML = '';

    // 内置映射（只读展示）
    bodyHTML += '<div style="margin-bottom:16px;">';
    bodyHTML += '<div style="font-size:13px;font-weight:600;color:#1A2634;margin-bottom:8px;">内置映射（不可修改）</div>';
    for (var bk in builtIn) {
      if (builtIn.hasOwnProperty(bk)) {
        bodyHTML += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#8A9BB0;">';
        bodyHTML += '<span>' + bk + '</span>';
        bodyHTML += '<span>→ ' + builtIn[bk] + '</span>';
        bodyHTML += '</div>';
      }
    }
    bodyHTML += '</div>';

    // 自定义映射（可删除）
    bodyHTML += '<div style="margin-bottom:16px;">';
    bodyHTML += '<div style="font-size:13px;font-weight:600;color:#1A2634;margin-bottom:8px;">自定义映射</div>';

    var customKeys = Object.keys(custom);
    if (customKeys.length === 0) {
      bodyHTML += '<div style="font-size:13px;color:#8A9BB0;">暂无自定义映射</div>';
    } else {
      for (var ci = 0; ci < customKeys.length; ci++) {
        var ck = customKeys[ci];
        bodyHTML += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">';
        bodyHTML += '<span style="font-size:13px;">' + ck + ' → ' + custom[ck] + '</span>';
        bodyHTML += '<button class="btn-delete" onclick="deleteCustomAlias(\'' + ck.replace(/'/g, "\\'") + '\')">删除</button>';
        bodyHTML += '</div>';
      }
    }
    bodyHTML += '</div>';

    // 新增
    bodyHTML += '<div style="border-top:1px solid #E8EFF5;padding-top:12px;">';
    bodyHTML += '<div style="font-size:13px;font-weight:600;color:#1A2634;margin-bottom:8px;">添加新映射</div>';
    bodyHTML += '<div style="display:flex;gap:8px;align-items:center;">';
    bodyHTML += '<input type="text" class="form-input" id="alias-key-input" placeholder="简称" style="flex:1;" />';
    bodyHTML += '<span style="color:#8A9BB0;">→</span>';
    bodyHTML += '<input type="text" class="form-input" id="alias-value-input" placeholder="对应产品全名" style="flex:1;" />';
    bodyHTML += '</div>';
    bodyHTML += '</div>';

    showModal('简称映射管理', bodyHTML,
      '<button class="btn-secondary" onclick="closeModal()">关闭</button>' +
      '<button class="btn-primary" onclick="addCustomAlias()">添加</button>'
    );
  });
}

function addCustomAlias() {
  var key = document.getElementById('alias-key-input').value.trim();
  var value = document.getElementById('alias-value-input').value.trim();
  if (!key || !value) { showToast('请输入简称和对应产品名'); return; }

  dbGet('systemConfig', 'customAliases', function(record) {
    var custom = {};
    if (record && record.value) {
      try { custom = JSON.parse(record.value); } catch(e) {}
    }
    custom[key] = value;

    dbUpdate('systemConfig', { key: 'customAliases', value: JSON.stringify(custom) }, function() {
      showToast('映射已添加');
      showAliasManager(); // 刷新弹窗
    });
  });
}

function deleteCustomAlias(aliasKey) {
  dbGet('systemConfig', 'customAliases', function(record) {
    var custom = {};
    if (record && record.value) {
      try { custom = JSON.parse(record.value); } catch(e) {}
    }
    delete custom[aliasKey];

    dbUpdate('systemConfig', { key: 'customAliases', value: JSON.stringify(custom) }, function() {
      showToast('已删除');
      showAliasManager();
    });
  });
}

/* ========== 页面切换时加载 ========== */
document.addEventListener('DOMContentLoaded', function() {
  var _origShowPage = showPage;
  showPage = function(pageId) {
    _origShowPage(pageId);
    if (pageId === 'page-products') {
      loadProductList();
    }
  };
});
