# 🚀 Deploy: GitHub + Cloudflare Pages

## Estructura final del repositorio

```
tebam-digital/
├── login.html          ← Página de inicio de sesión
├── app.html            ← Panel docente principal
├── _headers            ← Headers de seguridad Cloudflare
├── .gitignore
├── .env.example
├── README.md
└── supabase/
    └── migrations/
        ├── 001_schema.sql
        ├── 002_rls.sql
        └── 003_security_hardening.sql
```

---

## Paso 1 — Crear el repositorio en GitHub

```bash
# En tu máquina local, crea la carpeta y entra
mkdir tebam-digital && cd tebam-digital

# Inicia git
git init

# Copia los archivos descargados aquí:
# login.html, app.html, _headers, .gitignore, .env.example, README.md
# y la carpeta supabase/migrations/

# Primer commit
git add .
git commit -m "feat: estructura base TEBAM Digital con Supabase"

# Crea el repo en GitHub (requiere GitHub CLI instalado)
gh repo create tebam-digital --public --source=. --push

# Si no tienes GitHub CLI, ve a github.com → New repository
# Nómbralo: tebam-digital
# Luego conecta y sube:
git remote add origin https://github.com/TU_USUARIO/tebam-digital.git
git branch -M main
git push -u origin main
```

---

## Paso 2 — Conectar Cloudflare Pages

1. Ve a **[dash.cloudflare.com](https://dash.cloudflare.com)**
2. Menú izquierdo: **Workers & Pages** → **Create application** → **Pages**
3. Clic en **Connect to Git** → Autoriza GitHub → Selecciona `tebam-digital`
4. Configuración del build:

| Campo | Valor |
|-------|-------|
| Project name | `tebam-digital` |
| Production branch | `main` |
| Build command | *(dejar vacío)* |
| Build output directory | `/` ← raíz del repo |
| Root directory | `/` |

5. Clic en **Save and Deploy** ✓

Tu app quedará disponible en:
**`https://tebam-digital.pages.dev`**

---

## Paso 3 — Configurar Supabase para aceptar tu dominio

Entra a **[supabase.com/dashboard](https://supabase.com/dashboard)** →
Proyecto `tebam-digital` → **Authentication** → **URL Configuration**:

```
Site URL:
https://tebam-digital.pages.dev

Redirect URLs (agregar):
https://tebam-digital.pages.dev/**
http://localhost:3000/**
```

Esto es necesario para que el login redirija correctamente.

---

## Paso 4 — Flujo de trabajo diario

Cada vez que hagas cambios:

```bash
git add .
git commit -m "feat: descripción del cambio"
git push origin main
# → Cloudflare detecta el push y despliega en ~30 segundos
```

Para ver el estado del deploy:
**Cloudflare Dashboard → Workers & Pages → tebam-digital → Deployments**

---

## Paso 5 — Crear el primer usuario docente

1. Ve a **Supabase Dashboard → Authentication → Users**
2. Clic en **Add user** → **Create new user**
3. Email: `docente@tebam.edu.mx`
4. Password: (la que definas)
5. ✅ **Auto Confirm User** (para no requerir correo de confirmación en desarrollo)

El trigger `handle_new_user` crea el perfil automáticamente.

---

## Credenciales del proyecto Supabase

```
Project ID : ivmakshnjjgyjxytviqp
URL        : https://ivmakshnjjgyjxytviqp.supabase.co
Anon Key   : sb_publishable_G5Z7F_qeyg_D0RgGHFHJKw_X_lPJDX7
Region     : us-east-1
```

---

## ¿Dominio propio? (opcional)

En Cloudflare Pages → tu proyecto → **Custom domains**:
- Agrega `tebam.edu.mx` o `app.tebam.edu.mx`
- Cloudflare configura el SSL automáticamente en ~1 minuto
