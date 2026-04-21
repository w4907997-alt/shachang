/* ================= backup.js v3.0 ================= */
/* 数据备份、恢复、清空 + 备份提醒 + Excel导出提醒 */
/* 含：N6备份提醒改15天、Excel导出提醒7天 */

/* ========== 备份数据 ========== */
function backupData() {
  var tables = ['products', 'customers', 'customerAddresses', 'customerPrices', 'orders', 'orderItems', 'chatMessages'];
  var backup = {};
  var done = 0;

  for (var i = 0; i < tables.length; i++) {
    (function(name) {
      dbGetAll(name, function(data) {
        backup[name] = data;
        done++;
        if (done === tables.length) {
          var json = JSON.stringify(backup, null, 2);
          var blob = new Blob([json], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = '沙场记账备份_' + getTodayString() + '.json';
          a.click();
          URL.revokeObjectURL(url);

          // 记录备份时间
          dbUpdate('systemConfig', { key: 'lastBackupTime', value: new Date().toISOString() }, function() {});
          showToast('备份文件已下载');
        }
      });
    })(tables[i]);
  }
}

/* ========== 恢复数据 ========== */
function restoreData() {
  showConfirm('恢复数据', '恢复将覆盖当前所有数据，确定继续吗？', function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          var tables = ['products', 'customers', 'customerAddresses', 'customerPrices', 'orders', 'orderItems', 'chatMessages'];
          var done = 0;

          for (var i = 0; i < tables.length; i++) {
            (function(name) {
              if (!data[name]) { done++; checkDone(); return; }

              dbClear(name, function() {
                var tx = db.transaction(name, 'readwrite');
                var store = tx.objectStore(name);
                for (var j = 0; j < data[name].length; j++) {
                  store.put(data[name][j]);
                }
                tx.oncomplete = function() { done++; checkDone(); };
              });
            })(tables[i]);
          }

          function checkDone() {
            if (done === tables.length) {
              showToast('数据恢复成功');
              try { if (typeof loadHomePage === 'function') loadHomePage(); } catch(e) {}
            }
          }
        } catch(err) {
          showToast('文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

/* ========== 清空所有数据 ========== */
function clearAllData() {
  var bodyHTML =
    '<div class="form-section">' +
    '<label class="form-label">此操作将删除所有客户、订单、产品数据，不可恢复！</label>' +
    '<label class="form-label">请输入密码确认</label>' +
    '<input type="password" class="form-input" id="clear-pw" maxlength="4" inputmode="numeric" placeholder="输入4位密码" />' +
    '</div>';

  showModal('确认清空', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" style="background:#e53935;" onclick="doClearAll()">确认清空</button>'
  );
}

function doClearAll() {
  var pw = document.getElementById('clear-pw').value;

  dbGetAll('systemConfig', function(configs) {
    var savedPw = null;
    for (var i = 0; i < configs.length; i++) {
      if (configs[i].key === 'app_password') savedPw = configs[i].value;
    }

    if (savedPw && pw !== savedPw) {
      showToast('密码错误');
      return;
    }

    var tables = ['products', 'customers', 'customerAddresses', 'customerPrices', 'orders', 'orderItems', 'chatMessages'];
    var done = 0;

    for (var j = 0; j < tables.length; j++) {
      dbClear(tables[j], function() {
        done++;
        if (done === tables.length) {
          closeModal();
          showToast('所有数据已清空');
          try { loadHomePage(); } catch(e) {}
        }
      });
    }
  });
}

/* ========== N6：备份提醒（改为15天） ========== */
function checkBackupReminder() {
  dbGetAll('systemConfig', function(configs) {
    var lastBackup = null;
    var lastExport = null;

    for (var i = 0; i < configs.length; i++) {
      if (configs[i].key === 'lastBackupTime') lastBackup = configs[i].value;
      if (configs[i].key === 'lastExportTime') lastExport = configs[i].value;
    }

    // 备份提醒：15天
    checkSingleReminder(lastBackup, 15, '备份', '您已经超过15天没有备份数据了，建议立即备份防止数据丢失。', function() {
      backupData();
    });

    // Excel导出提醒：7天（延迟显示，避免同时弹两个）
    setTimeout(function() {
      checkSingleReminder(lastExport, 7, '导出', '您已经超过7天没有导出Excel了，建议定期导出留档。', function() {
        dbUpdate('systemConfig', { key: 'lastExportTime', value: new Date().toISOString() }, function() {});
        exportExcel();
      });
    }, 1500);
  });
}

function checkSingleReminder(lastTime, days, label, message, onConfirm) {
  if (!lastTime) {
    // 没有记录过，检查是否有数据
    dbGetAll('orders', function(orders) {
      if (orders.length > 0) {
        showConfirm(label + '提醒', message, onConfirm);
      }
    });
    return;
  }

  var diff = (new Date().getTime() - new Date(lastTime).getTime()) / (1000 * 60 * 60 * 24);
  if (diff >= days) {
    showConfirm(label + '提醒', message, onConfirm);
  }
}

/* ========== 启动时检查提醒 ========== */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (db) checkBackupReminder();
  }, 2000);
});
