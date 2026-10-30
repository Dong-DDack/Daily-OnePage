# 📖 하루 한 장

> **계획을 적고, 오늘의 실행을 남기고, 다음 계획을 돌아보는 Plan · Do · See 다이어리**

<p align="center">
  <a href="https://daily-one-page.vercel.app/"><strong>🌐 배포 화면 열기</strong></a>
  &nbsp; · &nbsp;
  <a href="https://github.com/Dong-DDack/Daily-OnePage"><strong>⌂ GitHub 소스 보기</strong></a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-111111?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Database-Supabase-3ecf8e?logo=supabase&logoColor=white">
</p>

> ⚠️ **현재 로그인 기능이 없습니다. 배포 주소를 아는 누구나 기록을 볼 수 있습니다. 공개해도 괜찮은 내용만 입력하세요.**

## ✨ 이 다이어리에서 하는 일

달력에서 날짜를 고르고, 그날 할 일을 체크하며, 실제로 쓴 시간과 막힌 이유를 남깁니다. 계획과 실행을 따로 저장해 시간이 지나도 처음 계획을 돌아볼 수 있도록 만들었습니다.

| 페이지 | 할 수 있는 일 |
| --- | --- |
| **월간** | 날짜별 일정을 보고 계획을 만듭니다. |
| **주간** | 한 주의 할 일과 완료 상태를 살펴봅니다. |
| **하루** | 할 일을 추가·수정·완료·복원·삭제하고, 실제 실행 기록을 남깁니다. |
| **돌아보기** | 완료·지연·막힘과 예상·실제 시간을 확인하고 다음 계획 메모를 씁니다. |
| **설정** | 글꼴과 색상 테마를 바꾸고 자료를 JSON 파일로 내보냅니다. |

## 🧭 기록 흐름

1. **Plan** — 기간, 우선순위, 성공 기준, 예상 시간을 정합니다. 계획을 수정하면 이전 내용은 수정 이력으로 남습니다.
2. **Do** — 계획에 속한 할 일의 마감일, 우선순위, 태그, 예상 시간과 완료 상태를 기록합니다.
3. **See** — 실행 시간과 막힌 이유를 돌아보고, 다음 계획에 가져갈 한 줄을 적습니다.

## 🗄️ 데이터베이스

앱은 Supabase PostgreSQL의 `public` 스키마를 사용합니다.

| 테이블 | 저장하는 내용 | 연결 |
| --- | --- | --- |
| `plans` | 계획과 기간·우선순위·성공 기준·예상 시간 | 수정 이력과 할 일의 상위 계획 |
| `plan_revisions` | 계획을 수정하기 전의 스냅샷 | `plan_id → plans.id` |
| `tasks` | 할 일, 마감일, 태그, 예상 시간, 완료·삭제 상태 | `plan_id → plans.id` |
| `execution_logs` | 시작·종료 시각, 실제 시간, 막힌 이유 | `task_id → tasks.id` |
| `reflections` | 기간별 회고와 다음 계획 메모 | `plan_id → plans.id` |

날짜만 필요한 값은 `DATE` (`YYYY-MM-DD`)로 저장합니다. 시각은 `TIMESTAMPTZ`로 저장하고 화면에는 서울 시간으로 보여 줍니다. 예상 시간과 실제 시간의 단위는 분입니다. 전체 필드와 관계는 [`contracts/pds-schema-v2.json`](contracts/pds-schema-v2.json)에 적었습니다.

## 🚀 로컬에서 실행하기

Node.js와 npm이 필요합니다. 먼저 저장소를 내려받고 의존성을 설치합니다.

```bash
git clone https://github.com/Dong-DDack/Daily-OnePage.git
cd Daily-OnePage
npm install
```

프로젝트 루트에 `.env.local` 파일을 만들고 **Supabase Project URL**과 **Publishable key**를 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 프로덕션 빌드는 `npm run build`로 만들 수 있습니다.

## 🔐 공개 범위와 키 관리

- 로그인이 없으며 Supabase `anon` 역할이 데이터를 읽고 쓸 수 있도록 RLS 정책이 설정되어 있습니다. 현재 데이터는 앱 사용자 사이에 분리되지 않습니다.
- 브라우저에는 `NEXT_PUBLIC_` 환경 변수와 Supabase **publishable key**만 사용합니다. `service_role` 같은 비밀 키는 브라우저 코드나 저장소에 넣지 마세요.
- `.env.local`은 Git에서 제외됩니다. Vercel 배포 환경 변수는 Vercel 프로젝트 설정에 별도로 등록합니다.
- 다른 사람의 이름·연락처나 민감한 개인 기록을 입력하지 마세요.

## 🛠️ 사용 기술

Next.js · React · TypeScript · Tailwind CSS · Lucide React · Supabase PostgreSQL · Vercel
