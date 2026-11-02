/** 캐싱·업데이트만 담당한다. 서비스 워커는 예약 타이머가 아니다. */
export async function setupPWA({ busy, status, waiting }) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status('오프라인 준비 불가 · HTTPS 또는 localhost로 접속하세요.');
    return { check: async () => {}, apply: () => false };
  }
  let registration;
  let requestedReload = false;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requestedReload && !reloading) {
      reloading = true;
      window.location.reload();
    } else if (navigator.serviceWorker.controller) {
      status('오프라인 준비 완료 · 이 기기에서 오프라인 실행을 확인하세요.');
    }
  });

  function hasWaiting() {
    if (registration && registration.waiting) {
      waiting(true);
      return true;
    }
    return false;
  }

  try {
    registration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './', updateViaCache: 'none'
    });
    hasWaiting();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          if (navigator.serviceWorker.controller) hasWaiting();
          else status('오프라인 파일 저장 완료 · 홈 화면에서 온라인으로 한 번 열어 주세요.');
        } else if (worker.state === 'redundant') {
          status('오프라인 파일 준비/업데이트 실패 · 온라인에서 다시 확인하세요.');
        }
      });
    });
    if (registration.active) {
      status('오프라인 캐시 사용 중 · 저장 공간 정리 시 삭제될 수 있습니다.');
    } else {
      status('오프라인 사용을 위한 파일을 저장하고 있습니다.');
    }
  } catch (_) {
    status('오프라인 등록 실패 · HTTPS 주소와 파일 업로드 상태를 확인하세요.');
  }

  return {
    async check() {
      if (!registration) {
        status('서비스 워커가 없습니다. HTTPS로 접속한 뒤 새로 여세요.');
        return;
      }
      try {
        await registration.update();
        if (!hasWaiting()) {
          status('업데이트 확인 요청 완료 · 새 파일이 있으면 준비 후 표시됩니다.');
        }
      } catch (_) {
        status('업데이트를 확인하지 못했습니다. 인터넷 연결을 확인하세요.');
      }
    },
    apply() {
      if (!registration || !registration.waiting || busy()) return false;
      requestedReload = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
  };
}
