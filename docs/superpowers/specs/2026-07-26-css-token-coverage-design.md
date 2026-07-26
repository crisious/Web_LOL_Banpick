# styles.css 잔여 raw 값 토큰화 설계

- 날짜: 2026-07-26
- 대상: `styles.css`, `scripts/design-audit.js`
- 선행 작업: 정확 일치 17건 치환 완료 (커버리지 colors 91.9% / radius 92.9% / spacing 87.8% / fontSize 96.6%)

## 배경

`scripts/design-audit.js` 기준으로 `styles.css`에 raw 값 82건이 남아 있다. 전수 조사(`--top 999 --format json`) 결과 이는 균질한 부채가 아니라 성격이 다른 네 덩어리였다.

| 분류 | colors | radius | spacing | fontSize | 계 |
|---|---:|---:|---:|---:|---:|
| 감사 도구 오집계 (`.evidence-lab` 토큰 정의) | 11 | – | – | – | 11 |
| 알파 파생 가능 | 13 | – | – | – | 13 |
| 반복 사용 (2회 이상) | 4 | 5 | 8 | 0 | 17 |
| 단발 사용 (1회) | 29 | 5 | 11 | 7 | 52 |

핵심 구조적 사실 두 가지:

1. **`.evidence-lab`(styles.css:4915)은 자체 토큰 레이어를 갖는다.** `--evidence-bg`부터 `--evidence-red`까지 11개를 컴포넌트 스코프로 정의한다. 감사 도구는 `:root`만 토큰 정의 블록으로 인식하므로 이 11줄을 raw 색상으로 오집계한다. 즉 colors 커버리지 91.9%는 실제보다 낮게 나온 값이다.
2. **`.tf-*`는 `.evidence-lab`의 형제다.** index.html에서 `.evidence-lab` 섹션은 237행에서 닫히고 `#teamfight-phases`는 296행에서 시작한다. 따라서 `.tf-*` 규칙에서는 `--evidence-*`가 해석되지 않는다 — 사용하면 값이 무효화되어 스타일이 깨진다.

## 목표

- 반복 사용되는 값과 알파 파생 관계를 토큰으로 승격한다.
- 미정의 토큰 참조 버그를 없앤다.
- 감사 도구가 컴포넌트 스코프 토큰을 인식하게 해 지표를 정확히 만든다.

## 비목표

- 단발 리터럴은 원칙적으로 그대로 둔다. 한 번만 쓰이는 값에 이름을 붙이면 중복 제거 이득 없이 조회 단계만 늘어난다.
  - 예외 2건: `#6ee7b7`(4901)과 `#f47272`(4895)는 단발이지만 §2에서 베이스 토큰으로 승격한다. 각각 바로 옆 줄의 태그 배경(4900/4894)이 이 색의 알파 변형이므로, 베이스를 토큰화하지 않으면 파생 관계를 표현할 수 없다.
  - 따라서 단발 52건 중 50건이 리터럴로 남는다.
- 미완성 래더 증설은 하지 않는다 (아래 "후속 관찰" 참조).

## 원칙

**픽셀 동일 유지.** 기존 토큰에 정확히 일치하거나 계산상 동일한 값만 사용한다. 값이 다르면 스냅하지 않고 원래 값을 담은 새 토큰을 만든다.

**예외 2건(승인됨).** 같은 역할에 알파가 드리프트한 곳만 통합한다. 근거는 인접 형제 규칙이 미세하게 다른 값을 쓰고 있어 의도적 구분으로 보기 어렵다는 점이다.

| 예외 | 변경 | 영향 |
|---|---|---|
| 배지 테두리 알파 | 34% / 40% / 42% → **38%** | 1px 테두리 3곳, 최대 0.08 |
| `.tf-tag` 배경 알파 | 16% / 18% → **17%** | 태그 배경 2곳, 0.01 |

`color-mix()`가 rgba 리터럴과 픽셀 동일한지는 Chrome 150에서 4가지 배경(#06101d, #0b1d2f, #ffffff, #808080)에 합성해 바이트 비교로 검증했다 — 11/11 일치. 프리멀티플라이드 알파 규칙상 `color-mix(in srgb, C p%, transparent)`는 `C`를 알파 `p`로 적용한 것과 같다.

## 섹션 1 — `.evidence-lab` 알파 파생 레이어

`.evidence-lab`의 기존 베이스 팔레트 아래(styles.css:4926 다음)에 추가한다.

```css
  /* 알파 파생 레이어 — 베이스 색에서 계산으로 유도하므로 베이스 변경이 자동 전파된다. */
  --evidence-border-alpha: 38%;
  --evidence-border-cyan:  color-mix(in srgb, var(--evidence-cyan)  var(--evidence-border-alpha), transparent);
  --evidence-border-green: color-mix(in srgb, var(--evidence-green) var(--evidence-border-alpha), transparent);
  --evidence-border-red:   color-mix(in srgb, var(--evidence-red)   var(--evidence-border-alpha), transparent);
  --evidence-ring-cyan:    color-mix(in srgb, var(--evidence-cyan) 24%, transparent);
  --evidence-fill-alpha: 8%;
  --evidence-fill-cyan:  color-mix(in srgb, var(--evidence-cyan)  var(--evidence-fill-alpha), transparent);
  --evidence-fill-green: color-mix(in srgb, var(--evidence-green) var(--evidence-fill-alpha), transparent);
  --evidence-fill-green-soft: color-mix(in srgb, var(--evidence-green) 14%, transparent);
  --evidence-grid-blue:  color-mix(in srgb, var(--evidence-blue) 3.5%, transparent);
```

치환 11곳:

| 줄 | 현재 값 | 교체 | 픽셀 |
|---:|---|---|---|
| 4945 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` | 동일 |
| 4946 | `rgba(79, 140, 255, 0.035)` | `var(--evidence-grid-blue)` | 동일 |
| 5004 | `rgba(54, 214, 231, 0.42)` | `var(--evidence-border-cyan)` | **42→38%** |
| 5006 | `rgba(54, 214, 231, 0.08)` | `var(--evidence-fill-cyan)` | 동일 |
| 5043 | `rgba(85, 214, 154, 0.38)` | `var(--evidence-border-green)` | 동일 |
| 5048 | `rgba(255, 115, 128, 0.4)` | `var(--evidence-border-red)` | **40→38%** |
| 5084 | `rgba(85, 214, 154, 0.34)` | `var(--evidence-border-green)` | **34→38%** |
| 5086 | `rgba(85, 214, 154, 0.08)` | `var(--evidence-fill-green)` | 동일 |
| 5111 | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` | 동일 |
| 5237 | `rgba(54, 214, 231, 0.24)` | `var(--evidence-ring-cyan)` | 동일 |
| 5419 | `rgba(85, 214, 154, 0.14)` | `var(--evidence-fill-green-soft)` | 동일 |

`--evidence-grid-blue`는 `.evidence-lab::before`에서 쓰인다. 커스텀 프로퍼티는 의사 요소로 상속되므로 문제없다.

이 섹션의 토큰 중 다수는 단발 사용이다. 정당화 근거는 중복 제거가 아니라 **파생 관계의 명시와 알파 노브**다 — 비목표에 적은 "단발 값은 토큰화하지 않는다"와 근거가 다르므로 혼동하지 말 것.

## 섹션 2 — `.tf-phase-row` 스코프 토큰

`.tf-*`에서 `--evidence-*`를 쓸 수 없다는 제약 때문에, `.evidence-lab`과 같은 패턴으로 자체 스코프 블록을 만든다. `.tf-phase-row`가 `.tf-tag`·`.tf-kd`의 조상이므로 스코프 루트로 적합하다.

동시에 미정의 토큰 참조 버그를 해소한다. `--border-subtle`과 `--text-muted`는 `styles.css` 어디에도 정의돼 있지 않고 `var()` 폴백만으로 동작하고 있다.

```css
.tf-phase-row {
  --tf-line:  var(--surface-4);   /* 기존 --border-subtle 폴백과 동일값, 전역 래더에 연결 */
  --tf-muted: #a9b3c1;            /* 기존 --text-muted 폴백을 그대로 승격 */
  --tf-win:   #6ee7b7;
  --tf-loss:  #f47272;
  --tf-fill-alpha: 17%;
  --tf-win-fill:  color-mix(in srgb, var(--tf-win)  var(--tf-fill-alpha), transparent);
  --tf-loss-fill: color-mix(in srgb, var(--tf-loss) var(--tf-fill-alpha), transparent);
  padding: 0.5rem 0;
  border-top: 1px solid var(--tf-line);
}
```

치환 7곳:

| 줄 | 현재 값 | 교체 | 픽셀 |
|---:|---|---|---|
| 4873 | `var(--border-subtle, rgba(255, 255, 255, 0.08))` | `var(--tf-line)` | 동일 |
| 4888 | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` | 동일 |
| 4894 | `rgba(244, 114, 114, 0.18)` | `var(--tf-loss-fill)` | **18→17%** |
| 4895 | `#f47272` | `var(--tf-loss)` | 동일 |
| 4900 | `rgba(110, 231, 183, 0.16)` | `var(--tf-win-fill)` | **16→17%** |
| 4901 | `#6ee7b7` | `var(--tf-win)` | 동일 |
| 4903 | `var(--text-muted, #a9b3c1)` | `var(--tf-muted)` | 동일 |

`--border-subtle` / `--text-muted`라는 이름을 쓰지 않고 `--tf-*`로 옮기는 이유: 두 이름은 전역 체계를 암시하지만 실제 사용처는 `.tf-*` 세 줄뿐이다. 전역에 올리면 기존 `--muted: #97afba`와 의미가 겹치는 두 번째 muted 텍스트 색이 루트에 생긴다.

## 섹션 3 — 반복값 토큰

| 토큰 | 값 | 스코프 | 대상 줄 |
|---|---|---|---|
| `--evidence-radius` | `18px` | `.evidence-lab` | 5016, 5181, 5454 |
| `--evidence-radius-sm` | `12px` | `.evidence-lab` | 5299, 5394 |
| `--evidence-surface-sunken` | `#091827` | `.evidence-lab` | 5300, 5395 |
| `--evidence-gap` | `18px` | `.evidence-lab` | 5166, 5173, 5188 |
| `--space-0` | `2px` | `:root` | 3129, 3140, 3285, 4616, 4822 |

15곳 모두 픽셀 동일.

- `--space-0`은 기존 `--space-1: 4px` 아래 스텝이다. 5곳 전부 `flex-direction: column` 스택의 라벨/값 간격이라 역할이 일치한다.
- `--evidence-surface-sunken`은 `#06101d`(bg)와 `#0b1d2f`(surface) 사이 값이며, 카드 내부 패널 배경으로 쓰인다.
- 5454는 `@media (max-width: 760px)` 안의 `.evidence-lab` 규칙이므로 스코프가 유지된다.
- radius와 gap이 둘 다 18px인 것은 우연이며 별개 토큰으로 둔다. 하나로 묶으면 무관한 두 결정이 결합된다.

## 섹션 4 — `scripts/design-audit.js` 오집계 수정

원인은 감사 대상 소스를 만드는 한 줄이다 (design-audit.js:740).

```js
const auditSource = blankRanges(sanitizedSource, [{ start: rootBlock.start, end: rootBlock.end }]);
```

`:root` 블록만 제외하므로 다른 블록의 커스텀 프로퍼티 정의가 raw 값으로 남는다.

수정:

1. `parseCustomPropertyDeclarations`(design-audit.js:205)가 각 선언의 끝 위치를 함께 반환하도록 `endIndex: index + match[0].length`를 추가한다.
2. `auditSource`를 만들 때 `:root` 블록 범위와 함께 `declaredInCss`의 **모든 선언 범위**를 blank 목록에 넣는다.

블록 전체가 아니라 선언 범위만 제외하는 것이 중요하다. `.evidence-lab`의 `gap: 20px`, `padding: 26px`, `box-shadow: … rgba(0, 0, 0, 0.26)`는 계속 감사 대상이어야 한다.

오프셋 정합성은 확인했다. `sanitizedSource`는 `stripComments(cssSource)`(design-audit.js:729)이고 `stripComments`는 주석의 비개행 문자를 공백으로 치환하므로 길이가 보존된다. `declaredInCss`는 `cssSource`에서 파싱되지만(design-audit.js:738) 두 문자열의 인덱스 공간이 같으므로 `sanitizedSource`에 그 범위를 그대로 blank 처리할 수 있다.

`test-artifacts/server/static-asset-http-tests.mjs:89`가 `/scripts/design-audit.js`를 참조하지만 정적 서빙 403 확인이므로 내용 변경과 무관하다.

## 검증

1. **픽셀 회귀 (자동 생성 하네스).** 위 표의 치환 목록에서 브라우저 검증 페이지를 생성해, 각 교체 값의 계산 결과를 원래 리터럴과 캔버스 합성 후 바이트 비교한다. 예외 5곳(5004, 5048, 5084, 4894, 4900)만 차이가 나야 하고 나머지 28곳은 전부 일치해야 한다. 예외 5곳은 차이가 예상 방향·크기인지 확인한다.
2. **감사 재실행.** `node scripts/design-audit.js --top 999`로 오집계 11건 소멸과 커버리지 상승 확인.
3. **테스트.** `npm test` 3124건 통과 유지.
4. **문법.** 중괄호 균형 및 주석 종료 확인.
5. **`color-mix` 지원 확인.** `CSS.supports('color', 'color-mix(in srgb, red 50%, transparent)')`가 대상 브라우저에서 true인지 확인. 이 프로젝트는 빌드 단계가 없어 폴리필·프리픽스 경로가 없으므로, 지원되지 않는 브라우저에서는 해당 선언이 무효화된다.

### 기대 결과

| 항목 | 현재 | 예상 |
|---|---:|---:|
| colors | 91.9% | ~97% |
| radius | 92.9% | ~96% |
| spacing | 87.8% | ~93% |
| fontSize | 96.6% | 변화 없음 |

신규 토큰 22개(알파 노브 3개 포함), 치환 33곳. `styles.css` 순변경은 약 +25행이다.

## 후속 관찰 (이번 범위 밖)

- **미완성 화이트 오버레이 래더.** `--surface-1`(0.03)·`-2`(0.04)·`-3`(0.06)·`-4`(0.08)이 있는데 raw로 0.02, 0.035, 0.05, 0.12, 0.18이 쓰인다. 래더의 빠진 스텝인지 우연인지 판단이 필요하다.
- **`--text-muted` 값 불일치.** `_design-mockups/improved-mockup.html:28` 등에서 `--text-muted: #b4c7d2`로 정의하지만 `styles.css`의 폴백은 `#a9b3c1`이다. 목업의 설계 의도가 반영되지 않았다. 어느 쪽이 정본인지 결정이 필요하다.
- **evidence 다크 서페이스·텍스트 계조.** `#0a1928`, `#17324a`, `#2a506a`, `#2a6385` / `#b8c8d5`, `#c6d4df`가 단발로 남아 있다. `--evidence-surface-*` 및 텍스트 래더의 추가 스텝일 가능성이 있다.
- **감사 도구의 의도적 예외 표기.** 현재 도구는 "의도적 단발 리터럴"과 "방치된 하드코딩"을 구분하지 못한다. 주석 기반 예외 표기(`/* design-audit-ignore */` 등)를 도입하면 커버리지 지표의 신호가 개선된다.
- **감사 도구의 spacing 범위가 좁다.** `collectPropertyDeclarations`에 넘기는 속성 목록이 `gap`·`row-gap`·`column-gap`뿐이다(design-audit.js:743). `padding`과 `margin`은 전혀 감사되지 않으므로 spacing 커버리지 87.8%는 간격 속성 전체가 아니라 gap 계열만 측정한 값이다. 예: `@media (max-width: 760px)`의 `.evidence-lab { padding: 18px }`(styles.css:5453)은 raw 값이지만 집계에 잡히지 않는다. 범위를 넓히면 실제 커버리지는 지금보다 낮게 나올 것이며, 그게 정확한 수치다.
- **감사 도구의 `--top` 기본값이 8이다.** 잘림 표시가 없어 한 번 실행한 결과를 전수로 오해하기 쉽다. 기본값을 올리거나 "N건 더 있음" 표기를 추가하면 좋다.
