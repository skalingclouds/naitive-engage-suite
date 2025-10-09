flowchart TD
    Start[User visits app] -->|Navigate to| SignInPage[Sign In Page]
    Start -->|Navigate to| SignUpPage[Sign Up Page]
    SignInPage -->|Submit credentials| AuthAPIRoute[Auth API Route]
    SignUpPage -->|Submit credentials| AuthAPIRoute
    AuthAPIRoute -->|Valid credentials| DashboardLayout[Dashboard Layout]
    AuthAPIRoute -->|Invalid credentials| ErrorMessage[Authentication Error]
    DashboardLayout --> DashboardPage[Dashboard Page]
    DashboardPage -->|Load static data| StaticData[data json]
    DashboardPage -->|Fetch dynamic data| DashboardAPIRoute[Dashboard Data API Route]
    DashboardPage -->|Render UI| DashboardUI[Render Dashboard UI]