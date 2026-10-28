# IntervalForge 1.0.0

Windows에서 준비하고 무료 HTTPS 정적 호스팅으로 배포한 뒤 iPhone Safari의 **홈 화면에 추가**로 사용하는 운동 타이머 PWA입니다.

**Mac, Xcode, Apple Developer 계정, 유료 도구, npm 설치, 빌드 과정이 필요하지 않습니다. App Store 앱이나 IPA가 아닙니다.**

이 프로젝트는 전체 소스·PNG 아이콘·테스트를 포함합니다. 사용자의 GitHub 저장소를 대신 만들거나 공개 사이트를 게시하지 않았습니다. 실제 실행 여부는 TEST-RESULTS.md를 보세요.

## 1. 기능과 한계

| 기능 | 구현 범위 |
|---|---|
| 네 가지 타이머 | Tabata, EMOM, AMRAP, 사용자 지정 Interval |
| 시간 계산 | 현재 시각과 기준 시각으로 계산. 1초씩 감소시키지 않음 |
| 일시정지·재개 | 밀리초 경과 보존, 재개 시 새 기준 시각 |
| 효과음 | Web Audio 생성. 외부 음원 없음. 사용자 클릭 후 활성화 |
| 화면 복귀 | 실제 경과한 여러 구간을 건너뛰어 현재 구간 계산 |
| 종료 후 재실행 | 같은 저장 컨텍스트에 데이터가 남아 있으면 복원 |
| 오프라인 | 최초 온라인 캐시 준비 후 사용. 저장된 캐시가 남아 있어야 함 |
| 화면 켜짐 유지 | 지원·허용되는 환경에서 Screen Wake Lock 요청 |
| 잠금 중 매초 실행·구간 소리 | **보장하지 않음** |
| 잠금 중 예약 알림 | **미구현. 정적 PWA만으로 정확한 iOS 예약 알림을 제공하지 않음** |

운동 신호를 놓치면 안 되는 경우에는 앱을 전면에 두고 화면을 켜 두세요. PWA 설치는 무제한 백그라운드 실행 권한을 주지 않습니다.

## 2. 기본 설정과 시간 정책

- **Tabata:** 운동20초 + 휴식10초 × 8회 = **240초, 4분**. 마지막10초 회복도 포함하며 ‘마지막 회복 구간’으로 표시합니다.
- **EMOM:** 60초 간격 × 10라운드 = 600초. 각 라운드 시작에 신호를 냅니다. 다른 간격도 설정할 수 있습니다.
- **AMRAP:** 기본600초, 사용자가 설정한 전체 시간의 카운트다운입니다.
- **Interval:** 기본20/10/8, 마지막 운동 뒤 휴식을 제외하여 **230초, 3분50초**입니다. 라운드1회면 휴식은 없습니다.
- READY는 시작 전 대기입니다. 별도 준비 카운트다운은 이 버전에 없습니다.
- 운동/EMOM 간격: 1~3600초.
- 휴식: 0~3600초.
- 라운드: 1~200회.
- AMRAP 전체: 1~21600초.
- 모든 모드의 전체 조합: 최대6시간.
- 빈 값, 음수, 소수, 문자, 지수 표기 문자열을 거부합니다.
- 실행/일시정지 중 운동 설정은 잠깁니다. 초기화 확인 후 변경할 수 있습니다. 소리·음량·화면 유지 옵션은 실행 중에도 변경 가능합니다.

Tabata에서도 마지막 휴식을 없애면 기본 합계는230초입니다. 이 프로젝트는 요청된 ‘Tabata4분’과 ‘사용자 지정 마지막 휴식 제외’를 구분합니다.

## 3. 전체 구조

```text
IntervalForge/
  index.html
  styles.css
  app.js
  timer-core.js
  cue-controller.js
  audio.js
  storage.js
  pwa.js
  manifest.webmanifest
  service-worker.js
  icons/
    icon-192.png
    icon-512.png
    icon-maskable-512.png
    apple-touch-icon.png
    favicon-32.png
    icon.svg
  tests/
    index.html
    browser-tests.js
    test-suite.js
    run-tests.mjs
  serve.py
  start-local.cmd
  package.json
  README.md
  TEST-RESULTS.md
  .nojekyll
  .gitignore
```

생성기에서 검사를 실행했다면 `tests/local-generator-report.json`도 포함됩니다.

- timer-core.js: 순수 타이머 엔진·검증·상태 직렬화.
- cue-controller.js: 구간·초 단위 중복 억제, 늦은 신호 생략.
- audio.js: Web Audio와 실패 처리.
- app.js: UI, 사용자 조작, 생명주기, 단일 화면 갱신 루프.
- storage.js: 저장 실패에도 타이머가 중단되지 않는 저장 계층.
- pwa.js/service-worker.js: 오프라인 준비·버전 업데이트.
- 아이콘은 직접 그린 정적 PNG이며 실행 시 외부에서 내려받지 않습니다.
- 웹 폰트·CDN·분석 SDK·외부 음원·JavaScript 라이브러리가 없습니다.

## 4. Windows: 로컬 실행

### 4-1. 압축 풀기

1. 생성한 ZIP을 우클릭하고 **모두 압축 풀기**를 선택합니다.
2. `IntervalForge` 안에 index.html, app.js, icons 폴더가 같은 단계에 있는지 확인합니다.
3. 예를 들어 문서 폴더에 둘 수 있습니다. 아래 경로는 사용자가 선택할 예시입니다.

```powershell
cd "$HOME\Documents\IntervalForge"
```

실제 위치가 다르면 해당 폴더의 탐색기 주소창에 `powershell`을 입력하여 터미널을 열 수 있습니다.

### 4-2. 파일 더블클릭과 로컬 서버의 차이

앱의 index.html을 더블클릭해 `file://`로 열면 JavaScript 모듈과 서비스 워커 보안 정책 때문에 정상 실행되지 않을 수 있습니다.

- 프로젝트 생성기 HTML은 더블클릭 실행용입니다.
- 생성된 **앱**은 HTTP localhost 또는 배포된 HTTPS 주소로 실행하세요.

Python3가 있다면:

```powershell
py -3 --version
py -3 serve.py
```

또는 `start-local.cmd`를 더블클릭합니다.

브라우저가 열리지 않으면 Edge/Chrome에서 `http://localhost:8000/`을 엽니다. 종료는 터미널에서 Ctrl+C입니다.

Python이 없다면 무료 공식 설치 파일을 이용합니다.

https://www.python.org/downloads/windows/

설치 관리자의 PATH·실행 별칭 옵션은 버전에 따라 다릅니다. `py`가 없으면 `python --version`으로 Python3인지 확인하고 다음을 사용합니다.

```powershell
python serve.py
```

Python 설치는 선택 사항입니다. 설치 없이 바로 GitHub Pages로 배포할 수 있습니다.

간단한 표준 서버도 가능합니다.

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

포트 충돌 시:

```powershell
py -3 serve.py --port 8001
```

이때는 `http://localhost:8001/`입니다. 포트가 바뀌면 저장소·서비스 워커도 별도입니다.

**주의**

- iPhone에서 localhost를 입력하면 Windows가 아니라 iPhone 자체를 찾습니다.
- 같은 Wi-Fi의 `http://192.168...` 주소는 일반적으로 보안 컨텍스트가 아니므로 PWA·오프라인 검사에 부적합합니다.
- iPhone 검사는 배포된 HTTPS 주소로 하세요. 인증서·방화벽을 복잡하게 설정할 필요가 없습니다.
- 편집기는 무료 VS Code를 추천하지만 필수는 아닙니다: https://code.visualstudio.com/

## 5. 무료 GitHub Pages 배포

2026-10-29 확인한 공식 문서 기준 **GitHub Free의 공개 저장소**에서 Pages를 사용할 수 있습니다. 이 경로에는 유료 Apple 계정·유료 개발 도구·사용자 도메인이 필요하지 않습니다. 서비스의 정책·할당량은 바뀔 수 있습니다.

저장소와 사이트가 공개되므로 개인정보·비밀번호·토큰을 올리지 마세요. 운동 설정은 기기 내부에 저장하며 저장소에 자동 업로드하지 않습니다.

### 5-1. 계정과 저장소 생성

1. https://github.com/ 에서 **Sign up**으로 무료 계정을 만들고 이메일 인증을 완료합니다.
2. 로그인 후 우측 상단 **+ → New repository**를 누릅니다.
3. Repository name: **intervalforge**
4. 공개 범위: **Public**
5. **Add README** 또는 **Add a README file**을 켭니다.
6. **Create repository**를 누릅니다.

### 5-2. 파일 업로드: Git 설치 불필요

1. 저장소 Code 화면에서 **Add file → Upload files**를 누릅니다.
2. 탐색기에서 압축을 푼 **IntervalForge 폴더 안으로** 들어갑니다.
3. **그 안의 파일 전부와 icons, tests 폴더를 함께** 업로드 영역으로 끌어다 놓습니다.
4. ZIP 하나만 올리거나 IntervalForge 폴더를 한 단계 더 감싸서 올리지 마세요.
5. 저장소 루트에서 index.html, app.js, manifest.webmanifest, service-worker.js, icons/가 보여야 합니다.
6. **Commit changes**로 main 브랜치에 반영합니다.
7. 기존 README는 제공된 README로 바꿔도 됩니다.
8. `.nojekyll`이 빠졌다면 Add file → Create new file에서 파일명을 `.nojekyll`로 하여 빈 파일을 추가할 수 있습니다.

### 5-3. Pages 활성화

1. 저장소 상단 **Settings**를 누릅니다. 안 보이면 상단의 `…` 메뉴를 확인합니다.
2. 왼쪽 **Pages**를 누릅니다.
3. **Build and deployment → Source → Deploy from a branch**
4. **Branch: main**
5. 폴더: **/(root)**
6. **Save**
7. 배포가 끝날 때까지 기다립니다. 공식 빠른 시작은 변경 반영에 최대10분 정도 걸릴 수 있다고 안내하지만 항상 그 시간 내 완료된다는 보장은 아닙니다.
8. **Actions**에서 Pages 배포 작업의 성공 여부를 확인할 수 있습니다.
9. Pages 화면의 **Visit site** 또는 표시된 **실제 사이트 주소**를 엽니다.

보통 다음 형태이지만 예시일 뿐 실제 생성된 주소가 아닙니다.

```text
https://YOUR-NAME.github.io/intervalforge/
```

사이트 주소 끝 `/`를 유지하는 편이 좋습니다.

`github.io` 도메인은 HTTPS가 제공됩니다. `https://` 접속인지 확인하고 Settings → Pages에 **Enforce HTTPS** 항목이 있으면 확인합니다. 사용자 도메인은 필요하지 않습니다.

메뉴는 확인한 공식 문서의 영문 기준이며 UI 언어·화면 폭·권한·향후 개편에 따라 달라질 수 있습니다.

### 5-4. 오류 해결

- 404: main / root 설정, 루트 index.html, Pages 배포 성공 여부 확인.
- 화면만 나오고 조작 불가: JS 파일 누락·대소문자·경로 확인.
- 오프라인 준비 실패: icons와 tests를 포함해 서비스 워커 ASSETS 목록의 파일이 모두 필요합니다. 한 파일의404도 캐시 설치 실패 원인이 됩니다.
- `IntervalForge/index.html`처럼 한 단계 아래에 잘못 업로드했다면 내부 파일을 루트로 옮깁니다.
- 경로가 바뀌면 해당 경로의 저장 상태와 서비스 워커는 별도로 취급될 수 있습니다.

### 5-5. 수정과 재배포

1. 소스를 수정합니다.
2. 배포 파일을 바꿀 때 **service-worker.js의 VERSION을 예: 1.0.1로 올립니다.**
3. 화면 버전과 package.json도 함께 맞추는 것을 권장합니다.
4. 파일을 추가·삭제했으면 서비스 워커 ASSETS도 수정합니다.
5. GitHub Add file → Upload files로 같은 위치에 반영하고 Commit changes합니다.
6. 배포 성공 후 iPhone 앱을 온라인에서 열고 **업데이트 확인**을 누릅니다.
7. 새 워커가 준비되면 **새 버전 적용**이 나타납니다.
8. 실행/일시정지 중에는 적용할 수 없습니다. 완료하거나 초기화한 뒤 적용합니다.
9. 사용자 선택 후 활성화·새로고침하며 같은 프로젝트의 오래된 캐시만 정리합니다. localStorage 설정과 다른 앱 캐시는 삭제하지 않습니다.

한 번에 한 창으로 사용하세요. 다른 탭에서 업데이트가 활성화되어도 현재 운동 창을 강제로 새로고침하지 않도록 했지만, 여러 창이 동시에 저장하는 문제까지 잠그지는 않습니다. 업데이트 시 창들을 닫고 온라인에서 다시 열어 버전을 통일하는 편이 안전합니다.

### 선택 사항: Git 사용

Git 설치는 필요하지 않습니다. 쓰고 싶다면 Git for Windows를 설치합니다.

https://git-scm.com/downloads/win

본인의 저장소 주소로 바꿔 실행합니다.

```powershell
git clone https://github.com/YOUR-NAME/intervalforge.git
cd intervalforge
# 프로젝트 내부 파일을 이 폴더에 복사
git add .
git commit -m "Add IntervalForge PWA"
git push
```

GitHub의 브라우저 로그인·자격 증명 관리자를 사용하세요. 비밀번호나 토큰을 코드에 저장하지 마세요.

## 6. iPhone 홈 화면 설치

권장 테스트 대상은 최신 보안 업데이트가 적용된 iOS16.4 이상 Safari입니다. 모든 버전을 실기기 검증했다는 뜻은 아닙니다. 화면 유지 등은 기능 감지와 실패 처리를 사용합니다.

1. iPhone을 Wi-Fi 또는 모바일 데이터에 연결합니다.
2. **Safari**에서 자신의 실제 GitHub Pages HTTPS 주소를 엽니다. GitHub 소스 화면이나 ZIP 주소가 아닙니다.
3. 기본 화면과 오프라인 준비 문구를 확인합니다.
4. **공유**를 누릅니다. 레이아웃에 따라 페이지 메뉴 → 공유일 수도 있습니다.
5. **홈 화면에 추가**를 누릅니다.
6. 없으면 공유 목록 맨 아래 **동작 편집**에서 해당 항목을 확인합니다.
7. **웹 앱으로 열기**가 보이면 켭니다.
8. 이름을 IntervalForge로 확인하고 **추가**합니다.
9. 홈 화면 아이콘으로 실행합니다.
10. 앱 상단의 **홈 화면 앱** 표시와 주소창 없는 레이아웃을 확인합니다.
11. **홈 화면 앱을 온라인에서 한 번 실행하여 캐시를 준비**합니다. Safari에서 준비했다고 홈 화면 앱의 캐시도 준비되었다고 가정하지 마세요.
12. **효과음 테스트 / 활성화**를 누릅니다.
13. 기기 미디어 음량·무음·이어폰·블루투스 출력 상태를 확인합니다.
14. 운동5초/휴식4초/2라운드 등 짧은 설정으로 시험합니다.

Safari와 홈 화면 앱의 저장 컨텍스트는 별도일 수 있습니다. Safari에서 바꾼 설정이 홈 화면 앱으로 자동 복사된다고 가정하지 마세요.

### iOS 버전 차이

WebKit의 Safari26 문서는 iOS/iPadOS26부터 홈 화면에 추가한 사이트가 기본적으로 웹 앱으로 열리며 사용자가 ‘웹 앱으로 열기’를 끌 수 있다고 설명합니다.

이전 버전을 고려하여 이 프로젝트는 manifest의 standalone, Apple 메타 태그, apple-touch-icon을 모두 제공합니다. iPhone Safari에 프로그램으로 자동 설치 팝업을 강제하는 기능은 없습니다.

## 7. 설치 확인과 오프라인

1. 홈 화면 아이콘으로 실행되는지 확인합니다.
2. 주소창 없는 standalone 화면인지 확인합니다.
3. 온라인에서 오프라인 준비 완료/캐시 사용 문구를 확인합니다.
4. 앱을 닫습니다.
5. 비행기 모드를 켜고 Wi-Fi도 꺼 실제 오프라인 상태로 만듭니다.
6. 같은 홈 화면 아이콘으로 다시 엽니다.
7. 화면, 모드 변경, 시작/일시정지/재개, 소리를 확인합니다.
8. 인터넷을 다시 켜고 잠금·복귀 테스트를 합니다.

캐시 준비 문구는 저장의 영구 보장을 뜻하지 않습니다. 저장 공간 부족, OS 정책, 사이트 데이터 삭제, 앱 제거로 캐시가 사라질 수 있습니다. 그때는 온라인에서 다시 준비해야 합니다.

## 8. 시간과 상태 모델

상태는 `idle → running ↔ paused → finished`입니다. 초기화는 idle로 돌아갑니다.

실행 중 경과 시간:

```text
저장된 이전 경과 시간 + max(0, 현재 epoch 시각 - 이번 재개 시각)
```

목표 종료 시각:

```text
이번 재개 시각 + 전체 길이 - 이전 경과 시간
```

- 숫자를 매초1씩 빼지 않습니다.
- UI는 requestAnimationFrame으로 갱신하지만 계산의 기준은 실제 시각입니다.
- 일시정지는 경과 밀리초를 고정하고 재개는 새 기준 시각을 사용합니다.
- 각 구간은 누적 시작/종료 시간을 가진 데이터입니다.
- 여러 구간이 지난 후 돌아오면 중간 이벤트를 순차 실행하지 않고 현재 구간을 찾습니다.
- 시작/정지 조작/구간 전환/숨김/pagehide에 저장하고 전면에서는 약5초마다 보조 저장합니다.
- 시작 시각이 이미 저장되어 있으므로 강제 종료 직전의 매초 표시가 저장되지 않아도 경과 시간을 복구할 수 있습니다.
- visibilitychange와 pageshow에서 보정하며 첫 관찰은 무음으로 처리합니다.
- 이미 완료된 운동은 FINISHED로 복원하지만 뒤늦게 종료음을 재생하지 않습니다.
- 화면 갱신 루프는 하나이며 숨김/일시정지/초기화 때 중지합니다.
- 서비스 워커에는 타이머 반복 루프가 없습니다.

기기의 시계가 맞다는 가정이 필요합니다. 사용자가 시각을 바꾸면 결과가 왜곡될 수 있습니다. 활성 실행 안에서는 이미 표시한 경과 시간이 뒤로 줄지 않게 하지만 시계 변경을 완전히 해결하지는 않습니다.

localStorage가 차단되거나 실패하면 경고하고 메모리에서 타이머를 진행합니다. 이때 재실행 복원은 보장되지 않습니다.

여러 탭·아이콘에서 동시 운동하지 마세요. 세션 소유권 잠금은 이 버전의 범위 밖이며 마지막 저장이 다른 창의 상태를 덮어쓸 수 있습니다.

## 9. 소리 정책

- 시작/재개/활성화 버튼의 직접 이벤트에서 AudioContext 생성 또는 resume을 호출합니다.
- 페이지 로드나 서비스 워커에서 소리를 자동 활성화하지 않습니다.
- 운동 시작: 높은2음.
- 휴식 시작: 낮은1음.
- EMOM 라운드 시작: 다른2음.
- 종료: 상승3음.
- 마지막3·2·1초: 짧은 신호 각1회.
- 구간·초 키를 기록해 프레임/일시정지/재개 중복을 막습니다.
- 3초 이하 구간 첫 순간에는 구간 시작음을 우선합니다. 3초 운동은 시작 신호→2→1이며 ‘3’과 시작음을 겹치지 않습니다.
- 콜백이1.8초 이상 늦거나 전환에서 크게 늦으면 지난 신호를 생략합니다.
- 복귀·복원 시 지난 소리를 몰아서 재생하지 않습니다.
- 숨김/일시정지/초기화/음소거 때 예약된 짧은 음도 취소합니다.
- 복귀 후 iOS가 오디오를 중단 상태로 유지하면 **효과음 테스트 / 활성화**를 직접 누릅니다.
- 실행 중 해당 버튼은 활성화만 하고 테스트 신호를 추가로 섞지 않습니다.
- 앱 음량과 iPhone 시스템/미디어 음량은 별개입니다.
- 다른 앱 오디오의 중지·믹싱 정책을 강제하지 않습니다. 실제 결과는 OS·브라우저·출력 장치에 따릅니다.
- 무음 루프·정책 우회용 지속 오디오는 없습니다.
- 오디오 생성/resume/출력 실패가 타이머를 중단하지 않습니다.

## 10. 잠금·백그라운드·알림의 정확한 한계

iOS는 페이지의 JavaScript와 오디오를 잠금/백그라운드에서 중단할 수 있습니다. **‘시간을 복원할 수 있음’과 ‘잠금 중 계속 실행됨’은 다릅니다.**

2026-10-29 확인한 Apple/WebKit 공식 자료에 따르면 iOS/iPadOS16.4 이상 홈 화면 웹 앱은 Web Push를 지원합니다. HTTPS, 설치된 홈 화면 웹 앱, 사용자 직접 동작에 따른 권한, Push 구독·발송 구현 등이 필요합니다. 유료 Apple Developer Program 가입 자체는 필수 조건이 아닙니다.

그러나:

1. Notifications API 지원은 미래 시각에 페이지를 깨우는 정확한 로컬 예약 기능을 뜻하지 않습니다.
2. Push는 발송 측과 인터넷·구독·권한이 필요합니다. GitHub Pages는 정적 호스팅이며 자체 예약 발송 서버가 아닙니다.
3. 서비스 워커는 이벤트 기반의 짧은 실행입니다. setInterval이나 Background Sync로 정확한 매초 운동 신호를 맡길 수 없습니다.
4. Push를 추가해도 전달 지연·집중 모드·알림 설정·오프라인·OS 정책 때문에 초 단위 전달을 보장할 수 없습니다.
5. 이 버전은 알림 권한을 요청하거나 Push 구독/발송을 구현하지 않습니다.
6. UI의 API 감지는 알림 기능 구현 완료 표시가 아닙니다.
7. 화면 유지 API는 전면에서만 도움을 주며 백그라운드 권한을 주지 않습니다. 배터리·저전력 모드·시스템 정책으로 거부/해제될 수 있습니다.
8. Safari 탭과 홈 화면 앱의 지원 조건을 동일하게 보지 마세요.

기본 대안은 **화면 복귀 후 정확한 상태 계산 + 전면 사용 + 가능한 환경의 화면 유지**입니다.

## 11. 자동 테스트

### 브라우저만으로

앱 하단의 **자동 테스트**를 누르거나 사이트의 `tests/index.html`을 엽니다.

- 가짜 시계를 사용하므로4분 로직을 빠르게 검사합니다.
- 가짜 AudioContext로 호출·음소거·실패 처리를 검사합니다.
- 실제 소리가 들리는지, iOS가 백그라운드에서 중단하는지는 검사하지 않습니다.
- 실제 사용자 저장소를 변경하지 않습니다.
- 운동 중에는 테스트 화면 이동을 막고 안내합니다.

### Node.js가 이미 있다면

Node18 이상에서 다음을 실행합니다. npm install은 필요하지 않습니다.

```powershell
node tests/run-tests.mjs
```

검사에는 설정 검증, 네 모드의 구간, 일시정지/재개, 저장·복원, 중복 소리, 오디오/저장소 실패, 1,000개 설정의 경계 불변조건이 포함됩니다.

## 12. 실제 iPhone 테스트 체크리스트

아래는 예상 결과이며 제작자의 실기기 결과가 아닙니다. 기기 모델, iOS, Safari/홈 화면 여부, 저전력 모드, 음량, 날짜, 실측 결과를 기록하세요.

|번호|절차|예상 결과와 제한|실기기 결과|
|---|---|---|---|
|1|Tabata20/10/8 기본 실행|총04:00, 8번째 운동 뒤10초 회복 후 FINISHED/0초/100%|미실행|
|2|Tabata5/4/2|운동5초→REST4초→다음 WORK, 색상 구분|미실행|
|3|5초 이상 운동·휴식의 마지막3초|3·2·1 각1회, 운동/휴식/종료 신호 구별|미실행|
|4|2.3초쯤 일시정지,10초 후 재개,5회 반복|멈춘 동안 고정, 재개 후 남은 밀리초부터 진행|미실행|
|5|초기화 취소, 이후 초기화 확인|취소하면 계속, 확인하면 READY/경과0/1라운드, 설정 유지|미실행|
|6|Interval5/10/1|총5초, 마지막 휴식 없음. Tabata1회는 회복 포함|미실행|
|7|Tabata와 Interval5/0/3|총15초, 0초 휴식 없이 라운드 전환|미실행|
|8|AMRAP7초|종료 후0초, FINISHED, 음수 없음|미실행|
|9|EMOM5초/3회, 이후 기본60초|누적 시각 기준 전환과 시작 신호|미실행|
|10|20/10/8 시작 후 다른 앱,약95초 후 복귀|4라운드 WORK/약15초. 중간 소리 보장 안 함. 지난 소리 재생 안 함|미실행|
|11|같은 설정으로35초 수동 잠금 후 복귀|2라운드 WORK/약15초. 잠금 중 소리 정지 가능|미실행|
|12|Safari 종료/PWA 프로세스 제거 후약95초 뒤 같은 위치에서 재실행|저장소가 남으면4라운드 WORK 근처. 종료시각 이후면 FINISHED. 일시정지 저장이면 고정|미실행|
|13|온라인 캐시 준비→닫기→비행기 모드 재실행|캐시가 남으면 화면·모드·타이머·소리 사용|미실행|
|14|홈 화면 아이콘 실행|아이콘·주소창 없는 화면·홈 화면 앱 표시|미실행|
|15|작은 화면·세로/가로·회전·확대|Safe Area와 버튼 유지, 작은 가로 화면은 스크롤 사용|미실행|
|16|소리 OFF/ON,음량0/70|OFF/0 무음, 타이머는 진행. 이후 신호만 재생|미실행|
|17|0/음수/빈값/소수/과도한 전체 입력|한국어 오류, 시작 거부, 정상 입력 후 회복|미실행|
|18|실행·일시정지 중 모드 변경 시도|운동 설정 잠김, 초기화 후 변경, 이전 루프 없음|미실행|
|19|저전력 모드·전화·블루투스 변경|실패해도 시간 상태 유지. 실제 소리와 화면 유지 별도 판정|미실행|
|20|새 버전 배포 후 운동 중 적용 시도|운동 중 비활성, 완료/초기화 후 활성화·리로드|미실행|

10~12번에서 **잠금 중 소리**와 **복귀 후 시간 상태**는 따로 판정하세요.

### 시간 복원 실측 예시

20/10/8을 시작하고 일시정지 없이95초가 지나면3개 운동+휴식이90초이므로4라운드 운동 경과5초/남은15초입니다.

잠금 해제·터치에 걸린 시간까지 실제 시각 차이로 비교하세요. 단순히 화면을 누른 횟수로 판단하지 마세요.

### Windows 콘솔·네트워크 확인

1. Edge/Chrome F12 → Console에서 새로고침 후 예상하지 못한 빨간 오류 확인.
2. Network에서 HTML·JS·CSS·manifest·PNG·service-worker 응답 확인.404는 누락/대소문자/경로 문제.
3. Application → Manifest에서 이름·아이콘·start_url 확인.
4. Application → Service Workers에서 활성 워커 확인.
5. Cache Storage에서 앱 파일 확인.
6. 개발자 도구의 오프라인 모드로 새로고침.
7. GitHub Pages의 하위 경로에서도 검사. 앱 경로는 상대 경로로 작성됨.

Windows Chromium 검사는 iOS WebKit 실기기 검증이 아닙니다. Windows만으로 표준 iPhone Safari Web Inspector를 사용하는 방법은 이 안내에 포함하지 않습니다.

## 13. 개인정보와 알려진 제한

- 로그인·회원가입·광고·분석 SDK·외부 API·운동 데이터 업로드 없음.
- 호스팅 사업자는 일반 웹 접속 로그를 처리할 수 있음.
- 설정과 진행 상태만 기기에 저장. 기기간 동기화 없음.
- 사용자 입력을 임의 HTML로 삽입하지 않음.
- 사이트 데이터 삭제·앱 제거·OS 저장 공간 정리 시 설정·진행·캐시가 사라질 수 있음.
- 비공개 브라우징에서는 저장 수명·복원이 달라질 수 있음.
- 여러 창 동시 운동의 세션 소유권 잠금은 없음.
- 이 버전은 운동 기록 목록, AMRAP 횟수 기록, 이름 있는 프리셋, 준비 카운트다운, 예약 Push 서버를 포함하지 않음.
- 잠금 중 신호의 신뢰성이 최우선이면 다른 실행 모델을 검토해야 함.

향후에는 프리셋 이름 관리, 기록 내보내기, 다중 탭 잠금, 접근성 실기기 조정, 선택형 준비 시간 등을 추가할 수 있습니다.

## 14. 공식 출처

다음은2026-10-29 확인한 자료입니다. 정책·메뉴·기기 버전은 바뀔 수 있습니다.

- GitHub Pages 제공 범위:
  https://docs.github.com/en/pages/getting-started-with-github-pages
- 실제 Pages 소스 설정 메뉴:
  https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- HTTPS:
  https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- 빠른 시작:
  https://docs.github.com/en/pages/quickstart
- Apple 한국어 홈 화면 웹 앱 안내:
  https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios
- WebKit: iOS16.4 홈 화면 Web Push·사용자 제스처·유료 계정 불필요:
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Safari16.4 정식 릴리스:
  https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- Safari26 홈 화면 웹 앱 변경:
  https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Apple: Push 구독과 발송 서버:
  https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- MDN Web Audio:
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- 자동재생 정책:
  https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- AudioContext 중단:
  https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state
- 화면 유지와 거부·해제:
  https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
