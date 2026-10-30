# 하루 한 장

Next.js와 Supabase를 사용하는 Plan → Do → See 다이어리입니다. 로그인 없이 열리며, 계획·할 일·실행 기록·회고를 Supabase PostgreSQL에 저장합니다.

## 실행

`.env.local`에 Supabase 프로젝트의 URL과 publishable key를 설정한 뒤 실행합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

```bash
npm install
npm run dev
```

## 데이터베이스

앱은 기존 `public` 스키마의 `plans`, `plan_revisions`, `tasks`, `execution_logs`, `reflections` 테이블을 사용합니다. Supabase Dashboard에서 anon 역할의 RLS 정책이 설정되어 있어야 합니다. 로그인 기능이 없으므로 링크를 아는 누구나 데이터를 읽고 수정할 수 있습니다. 민감한 내용은 저장하지 마세요.

브라우저에는 publishable key만 사용하며, service role key는 앱에 넣지 않습니다.
