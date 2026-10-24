import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ChatComponent } from './features/chat/chat.component';
import { ProfileComponent } from './features/profile/profile.component';
import { authGuard } from './core/guards/auth.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [publicGuard], title: 'Sign In — Commute RTC' },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard], title: 'Create Account — Commute RTC' },
  { path: 'chat', component: ChatComponent, canActivate: [authGuard], title: 'Chat & Calls — Commute RTC' },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard], title: 'My Profile — Commute RTC' },
  { path: '**', redirectTo: 'chat' }
];
