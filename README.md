# Agendamento App

## Passos para configurar

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative **Authentication** → Método **Email/Senha**.
3. Ative **Cloud Firestore** → modo produção.
4. Regras de segurança:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

5. Rode localmente com **Live Server** ou publique no **GitHub Pages**.
6. Estrutura de coleções no Firestore:
   - clientes
   - representantes
   - produtos
   - agendamentos

Todos os documentos devem ter o campo `userId`.
