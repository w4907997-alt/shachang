/* ================= chat.js v3.0 ================= */
/* 聊天式记账：输入文字 → 简称映射 → 解析 → 确认开单 */
/* 含：B1/B2/B8修复、N11聊天持久化、N12简称映射 */

/* ========== 简称映射表（N12） ========== */
var ALIAS_MAP = {
  '沙': '黄沙',
  '砂': '黄沙',
  '泥': '水泥',
  '砖': '小砖',
  '网': '钢网',
  '桥': '1.2过桥',
  '小桥': '1.2过桥',
  '过伙': '1.2过桥',
  '大桥': '1.5过桥',
  '陶': '陶粒',
  '粒': '陶粒',
  '大砖': '75大砖',
  '搬运': '水泥4楼搬运费'
};

/* ========== 简称替换函数 ========== */
function applyAliasMap(text) {
  // 从长到短排序，防止短的先匹配导致长的失效
  var keys = Object.keys(ALIAS_MAP).sort(function(a, b) {
    return b.length - a.length;
  });
  for (var i = 0; i < keys.length; i++) {
    var alias = keys[i];
    var fullName = ALIAS_MAP[alias];
    // 只替换独立出现的简称（后面跟数字或空格或结尾）
    // 避免把已经是全名的一部分误替换
    var regex = new RegExp('(?<![\\u4e00-\\u9fa5])' + escapeRegex(alias) + '(?![\\u4e00-\\u9fa5])', 'g');
    text = text.replace(regex, fullName);
  }
  return text;
}

/* ========== 发送消息 ========== */
function sendChatMessage() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';


  addChatBubble(text, 'user', true);
  parseOrderText(text);
}

/* ========== 添加聊天气泡 ========== */
function addChatBubble(content, type, save) {
  var container = document.getElementById('chat-messages');
  var welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.style.display = 'none';

  var timeDiv = document.createElement('div');
  timeDiv.className = 'chat-time';
  timeDiv.textContent = getNowString();
  container.appendChild(timeDiv);

  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + type;
  // B8修复：保留换行
  if (type === 'user') {
  // 先转义HTML，再把换行替换成<br>
  var escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  bubble.innerHTML = escaped.replace(/\n/g, '<br>');
} else {
  bubble.innerHTML = content;
}
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  // N11：保存到数据库
  if (save && db) {
    dbAdd('chatMessages', {
      content: content,
      type: type,
      date: getNowString()
    }, function() {});
  }
}

/* ========== 添加识别结果卡片 ========== */
function addResultCard(result) {
  var container = document.getElementById('chat-messages');
  var welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.style.display = 'none';

  var timeDiv = document.createElement('div');
  timeDiv.className = 'chat-time';
  timeDiv.textContent = getNowString();
  container.appendChild(timeDiv);

  var card = document.createElement('div');
  card.className = 'chat-result-card';

  var html = '<div class="chat-result-label">识别结果</div>';
  for (var i = 0; i < result.items.length; i++) {
    var item = result.items[i];
    html += '<div class="chat-result-item">';
    html += '<div class="chat-result-dot"></div>';
    html += item.productName + ' × ' + item.quantity + ' ' + (item.unit || '');
    html += '</div>';
  }
  if (result.customer) {
    html += '<div class="chat-result-item">';
    html += '<div class="chat-result-dot"></div>';
    html += '客户：' + result.customer;
    html += '</div>';
  }
  if (result.address) {
    html += '<div class="chat-result-item">';
    html += '<div class="chat-result-dot"></div>';
    html += '地址：' + result.address;
    html += '</div>';
  }
  if (result.phone && !result.customerId) {
    html += '<div class="chat-result-item">';
    html += '<div class="chat-result-dot"></div>';
    html += '电话：' + result.phone;
    html += '</div>';
  }
  html += '<button class="chat-confirm-btn" onclick="confirmChatOrder()">确认开单</button>';

  card.innerHTML = html;
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;

  // 保存到数据库
  if (db) {
    dbAdd('chatMessages', {
      content: '[识别结果卡片]',
      type: 'result',
      date: getNowString(),
      resultData: result
    }, function() {});
  }
}

/* ========== 添加成功提示 ========== */
function addSuccessCard() {
  var container = document.getElementById('chat-messages');

  var card = document.createElement('div');
  card.className = 'chat-success-card';
  card.innerHTML =
    '<div class="chat-success-icon">' +
    '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' +
    '</div>' +
    '<span class="chat-success-text">订单保存成功</span>';

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;

  // 保存到数据库
  if (db) {
    dbAdd('chatMessages', {
      content: '订单保存成功',
      type: 'success',
      date: getNowString()
    }, function() {});
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ========== 解析订单文本（B1修复 + N12简称映射） ========== */
function parseOrderText(text) {
  dbGetAll('products', function(products) {
    dbGetAll('customers', function(customers) {
      // 也加载自定义简称映射
      loadCustomAliases(function(customAliases) {
        var mergedAliases = {};
        // 先放内置的
        for (var k in ALIAS_MAP) {
          if (ALIAS_MAP.hasOwnProperty(k)) mergedAliases[k] = ALIAS_MAP[k];
        }
        // 再放自定义的（会覆盖内置的同名简称）
        if (customAliases) {
          for (var ck in customAliases) {
            if (customAliases.hasOwnProperty(ck)) mergedAliases[ck] = customAliases[ck];
          }
        }

        var result = {
          items: [],
          customer: null,
          customerId: null,
          phone: null,
          address: ''
        };

        // B1修复：先按逗号、换行、顿号分段
        var segments = text.split(/[,，、\n\r]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });

        var remaining = text;

        // 1. 提取手机号
        var phoneMatch = remaining.match(/1[3-9]\d{9}/);
        if (phoneMatch) {
          result.phone = phoneMatch[0];
          remaining = remaining.replace(phoneMatch[0], ' ');
        }

        // 2. 对每个分段做简称替换
        var processedText = remaining;
        var aliasKeys = Object.keys(mergedAliases).sort(function(a, b) {
          return b.length - a.length;
        });

        for (var ai = 0; ai < aliasKeys.length; ai++) {
          var alias = aliasKeys[ai];
          var fullName = mergedAliases[alias];
          // 检查这个简称是否已经是某个产品全名的一部分
          var isPartOfProduct = false;
          for (var pi = 0; pi < products.length; pi++) {
            if (products[pi].name.indexOf(alias) >= 0 && products[pi].name !== alias) {
              // 如果全名已经在文本中出现，就不替换
              if (processedText.indexOf(products[pi].name) >= 0) {
                isPartOfProduct = true;
                break;
              }
            }
          }
          if (!isPartOfProduct) {
            var aliasRegex = new RegExp(escapeRegex(alias), 'g');
            processedText = processedText.replace(aliasRegex, fullName);
          }
        }

        remaining = processedText;

        // 3. 先按分段处理，分段符：逗号、换行、顿号、空格组
// 重新分段（用原始替换后的文本）
var segs = remaining.split(/[,，、\n\r]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });

// 对每个分段，尝试匹配产品+数量
var sorted = products.slice().sort(function(a, b) {
  return b.name.length - a.name.length;
});

var matchedSegIndexes = [];

for (var si = 0; si < segs.length; si++) {
  var seg = segs[si];
  var segMatched = false;

  for (var pi = 0; pi < sorted.length; pi++) {
    var p = sorted[pi];
    var eName = escapeRegex(p.name);
    var qty = 0;

    // 产品名+数字
    var m1 = seg.match(new RegExp(eName + '\\s*(\\d+\\.?\\d*)'));
    if (m1 && m1[1] && parseFloat(m1[1]) > 0) {
      qty = parseFloat(m1[1]);
    }

    // 数字+产品名
    if (!qty) {
      var m2 = seg.match(new RegExp('(\\d+\\.?\\d*)\\s*' + eName));
      if (m2 && m2[1] && parseFloat(m2[1]) > 0) {
        qty = parseFloat(m2[1]);
      }
    }

    // 只有产品名没有数字 → 默认1
    if (!qty && seg.indexOf(p.name) >= 0) {
      qty = 1;
    }

    if (qty > 0) {
      // 检查是否已经添加过同一个产品（防止重复）
      var alreadyAdded = false;
      for (var ai = 0; ai < result.items.length; ai++) {
        if (result.items[ai].productId === p.id) {
          alreadyAdded = true;
          break;
        }
      }
      if (!alreadyAdded) {
        result.items.push({
          productId: p.id,
          productName: p.name,
          quantity: qty,
          price: p.price || 0,
          unit: p.unit || ''
        });
        segMatched = true;
        matchedSegIndexes.push(si);
        break; // 一个分段只匹配一个产品
      }
    }
  }
}

// 没匹配到产品的分段，看是不是客户名/地址（remaining用未匹配的分段拼起来）
var unmatchedSegs = [];
for (var ui = 0; ui < segs.length; ui++) {
  if (matchedSegIndexes.indexOf(ui) === -1) {
    unmatchedSegs.push(segs[ui]);
  }
}
remaining = unmatchedSegs.join(' ');


        // 4. 匹配客户姓名
        var cSorted = customers.slice().sort(function(a, b) {
          return b.name.length - a.name.length;
        });
        for (var j = 0; j < cSorted.length; j++) {
          if (remaining.indexOf(cSorted[j].name) >= 0) {
            result.customer = cSorted[j].name;
            result.customerId = cSorted[j].id;
            remaining = remaining.replace(cSorted[j].name, ' ');
            break;
          }
        }

        // 5. 电话匹配客户
        if (!result.customerId && result.phone) {
          for (var kk = 0; kk < customers.length; kk++) {
            if (customers[kk].phone === result.phone) {
              result.customer = customers[kk].name;
              result.customerId = customers[kk].id;
              break;
            }
          }
        }

        // 6. 剩余文字当地址
        remaining = remaining.replace(/[送到帮我去往]/g, '').replace(/\s+/g, ' ').trim();
        if (remaining.length > 0 && remaining.length < 50) {
          result.address = remaining;
        }

        // 显示结果
        if (result.items.length === 0) {
          // N2：如果没识别到商品但识别到客户，显示客户信息
          if (result.customerId) {
            showCustomerInfoInChat(result.customerId);
          } else {
            addChatBubble('没有识别出商品哦～<br/>请输入产品名称和数量<br/>例如：水泥20 黄沙15', 'system', true);
          }
          return;
        }

        window._lastParseResult = result;
        addResultCard(result);
      });
    });
  });
}

/* ========== N2：在聊天中显示客户信息 ========== */
function showCustomerInfoInChat(customerId) {
  dbGet('customers', customerId, function(customer) {
    if (!customer) return;
    dbGetAll('orders', function(orders) {
      var customerOrders = orders.filter(function(o) { return o.customerId === customerId; });
      var totalDebt = 0;
      for (var i = 0; i < customerOrders.length; i++) {
        if (!customerOrders[i].settled) {
          totalDebt += (customerOrders[i].totalAmount || 0) - (customerOrders[i].paidAmount || 0);
        }
      }
      customerOrders.sort(function(a, b) { return b.date > a.date ? 1 : -1; });
      var recent = customerOrders.slice(0, 3);

      var html = '<div style="margin-bottom:6px;font-weight:600;">客户：' + customer.name + '</div>';
      if (totalDebt > 0) {
        html += '<div style="color:#C07A5A;margin-bottom:6px;">欠款：' + formatMoney(totalDebt) + '</div>';
      } else {
        html += '<div style="color:#5A9E7A;margin-bottom:6px;">已全部结清</div>';
      }
      if (recent.length > 0) {
        html += '<div style="font-size:12px;color:#8A9BB0;margin-bottom:4px;">最近订单：</div>';
        for (var j = 0; j < recent.length; j++) {
          var ro = recent[j];
          html += '<div style="font-size:12px;color:#8A9BB0;">' + (ro.date || '').substring(0, 10) + ' ' + formatMoney(ro.totalAmount) + ' ' + (ro.summary || '') + '</div>';
        }
      }
      html += '<div style="margin-top:8px;"><span style="color:#5BA4C8;cursor:pointer;font-size:13px;" onclick="showCustomerDetail(' + customerId + ')">查看详情 ›</span></div>';

      addChatBubble(html, 'system', true);
    });
  });
}

/* ========== 加载自定义简称映射 ========== */
function loadCustomAliases(callback) {
  if (!db) { callback(null); return; }
  dbGet('systemConfig', 'customAliases', function(record) {
    if (record && record.value) {
      try {
        callback(JSON.parse(record.value));
      } catch(e) {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}

/* ========== 确认开单（B2修复） ========== */
function confirmChatOrder() {
  var result = window._lastParseResult;
  if (!result) return;

  window._chatOrderPending = true;

  openCashier({
    items: result.items,
    address: result.address || '',
    customerId: result.customerId || null
  });
}

/* ========== N11：加载历史聊天记录 ========== */
function loadChatHistory() {
  if (!db) return;
  dbGetAll('chatMessages', function(messages) {
    if (!messages || messages.length === 0) return;

    var container = document.getElementById('chat-messages');
    var welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.style.display = 'none';

    // 只显示最近50条
    var recent = messages.slice(-50);

    for (var i = 0; i < recent.length; i++) {
      var msg = recent[i];

      // 时间戳
      var timeDiv = document.createElement('div');
      timeDiv.className = 'chat-time';
      timeDiv.textContent = msg.date || '';
      container.appendChild(timeDiv);

      if (msg.type === 'success') {
        // 成功卡片
        var sCard = document.createElement('div');
        sCard.className = 'chat-success-card';
        sCard.innerHTML =
          '<div class="chat-success-icon">' +
          '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' +
          '</div>' +
          '<span class="chat-success-text">订单保存成功</span>';
        container.appendChild(sCard);
      } else if (msg.type === 'result' && msg.resultData) {
        // 识别结果卡片（历史记录不再显示确认按钮）
        var rCard = document.createElement('div');
        rCard.className = 'chat-result-card';
        var rHtml = '<div class="chat-result-label">识别结果</div>';
        var rd = msg.resultData;
        if (rd.items) {
          for (var ri = 0; ri < rd.items.length; ri++) {
            rHtml += '<div class="chat-result-item"><div class="chat-result-dot"></div>' +
              rd.items[ri].productName + ' × ' + rd.items[ri].quantity + ' ' + (rd.items[ri].unit || '') +
              '</div>';
          }
        }
        if (rd.customer) rHtml += '<div class="chat-result-item"><div class="chat-result-dot"></div>客户：' + rd.customer + '</div>';
        if (rd.address) rHtml += '<div class="chat-result-item"><div class="chat-result-dot"></div>地址：' + rd.address + '</div>';
        rCard.innerHTML = rHtml;
        container.appendChild(rCard);
      } else {
        // 普通气泡
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (msg.type || 'system');
        if (msg.type === 'user') {
  var escaped = (msg.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  bubble.innerHTML = escaped.replace(/\n/g, '<br>');
}
 else {
          bubble.innerHTML = msg.content || '';
        }
        container.appendChild(bubble);
      }
    }

    container.scrollTop = container.scrollHeight;
  });
}

/* ========== 页面初始化 ========== */
document.addEventListener('DOMContentLoaded', function() {
  // 发送按钮
  document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
// textarea自动撑高
var chatInput = document.getElementById('chat-input');
chatInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
chatInput.addEventListener('paste', function() {
  var self = this;
  setTimeout(function() {
    self.style.height = 'auto';
    self.style.height = Math.min(self.scrollHeight, 120) + 'px';
  }, 0);
});

  // B2修复：保存订单后回到聊天页时，只在真正保存成功时才显示成功提示
  var chatPage = document.getElementById('page-chat');
  if (chatPage) {
    new MutationObserver(function() {
      if (chatPage.classList.contains('active') && window._orderSavedOK && window._chatOrderPending) {
        window._chatOrderPending = false;
        window._orderSavedOK = false;
        setTimeout(function() {
          addSuccessCard();
        }, 300);
      } else if (chatPage.classList.contains('active') && window._chatOrderPending && !window._orderSavedOK) {
        // 返回但没保存，清除标记
        window._chatOrderPending = false;
      }
    }).observe(chatPage, { attributes: true, attributeFilter: ['class'] });
  }

  // 接管"记账"Tab
  var _prevSwitchTab = switchTab;
  switchTab = function(tabName) {
    if (tabName === 'chat') {
      pageHistory = [];
      var pages = document.querySelectorAll('.page');
      for (var p = 0; p < pages.length; p++) pages[p].classList.remove('active');
      document.getElementById('page-chat').classList.add('active');
      currentPage = 'page-chat';
      var navs = document.querySelectorAll('.nav-item');
      for (var n = 0; n < navs.length; n++) navs[n].classList.remove('active');
      navs[1].classList.add('active');
      return;
    }
    _prevSwitchTab(tabName);
  };

  // N11：加载历史聊天记录
  setTimeout(function() {
    if (db) loadChatHistory();
  }, 800);
});
