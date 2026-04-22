/* ================= auth.js v3.0 ================= */
/* 登录密码系统：4位数字密码，默认1130 */

var AUTH_KEY = 'app_password';
var AUTH_DEVICE = 'device_token';
var AUTH_EXPIRE_DAYS = 7;
var DEFAULT_PASSWORD = '1130';

/* ---------- 检查是否需要登录 ---------- */
function checkAuth() {
  // 防止重复调用
  if (window._authChecking) return;
  window._authChecking = true;

  dbGetAll('systemConfig', function(configs) {
    var password = null;
    var deviceToken = null;
    for (var i = 0; i < configs.length; i++) {
      if (configs[i].key === AUTH_KEY) password = configs[i].value;
      if (configs[i].key === AUTH_DEVICE) deviceToken = configs[i].value;
    }
    if (!password) {
      dbUpdate('systemConfig', { key: AUTH_KEY, value: DEFAULT_PASSWORD }, function() {
        checkDeviceToken(deviceToken, DEFAULT_PASSWORD);
      });
      return;
    }
    checkDeviceToken(deviceToken, password);
  });
}

function checkDeviceToken(deviceToken, password) {
  if (deviceToken) {
    try {
      var data = JSON.parse(deviceToken);
      var saved = new Date(data.time).getTime();
      var now = new Date().getTime();
      var diffDays = (now - saved) / (1000 * 60 * 60 * 24);
      if (diffDays < AUTH_EXPIRE_DAYS) {
        return; // 免登录
      }
    } catch(e) {}
  }
  showLoginScreen();
}

/* ---------- 登录界面 ---------- */
function showLoginScreen() {
  var overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.className = 'auth-overlay';

  var box = document.createElement('div');
  box.className = 'auth-box';
  box.innerHTML =
    '<h2>沙场记账</h2>' +
    '<p>请输入密码</p>' +
    '<input type="password" id="auth-pw-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="4位数字密码" />' +
    '<button id="auth-login-btn">进入系统</button>' +
    '<p class="auth-error" id="auth-error"></p>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

document.getElementById('auth-login-btn').onclick = function() {
  var pw = document.getElementById('auth-pw-input').value;
  var err = document.getElementById('auth-error');
  dbGet('systemConfig', AUTH_KEY, function(record) {
    var saved = record ? record.value : DEFAULT_PASSWORD;
    if (pw === saved) {
      saveDeviceToken();
      overlay.remove();
      showToast('登录成功');
    } else {
      err.textContent = '密码错误，请重试';
      document.getElementById('auth-pw-input').value = '';
    }
  });
};
  document.getElementById('auth-pw-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') document.getElementById('auth-login-btn').click();
  });
}

/* ---------- 保存设备令牌（免登录） ---------- */
function saveDeviceToken() {
  var token = {
    time: new Date().toISOString(),
    id: Math.random().toString(36)
  };
  dbUpdate('systemConfig', { key: AUTH_DEVICE, value: JSON.stringify(token) }, function() {});
}

/* ---------- 修改密码 ---------- */
function showChangePassword() {
  var bodyHTML =
    '<div class="form-section">' +
    '<label class="form-label">旧密码</label>' +
    '<input type="password" class="form-input" id="change-old-pw" maxlength="4" inputmode="numeric" placeholder="输入旧密码" />' +
    '</div>' +
    '<div class="form-section">' +
    '<label class="form-label">新密码</label>' +
    '<input type="password" class="form-input" id="change-new-pw" maxlength="4" inputmode="numeric" placeholder="输入新密码（4位数字）" />' +
    '</div>';

  showModal('修改密码', bodyHTML,
    '<button class="btn-secondary" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" onclick="doChangePassword()">确认</button>'
  );
}

function doChangePassword() {
  var oldPw = document.getElementById('change-old-pw').value;
  var newPw = document.getElementById('change-new-pw').value;

  if (!/^\d{4}$/.test(newPw)) {
    showToast('新密码必须是4位数字');
    return;
  }

  dbGetAll('systemConfig', function(configs) {
    var saved = null;
    for (var i = 0; i < configs.length; i++) {
      if (configs[i].key === AUTH_KEY) saved = configs[i].value;
    }

    if (oldPw !== saved) {
      showToast('旧密码错误');
      return;
    }

    dbUpdate('systemConfig', { key: AUTH_KEY, value: newPw }, function() {
      closeModal();
      showToast('密码已修改');
    });
  });
}
