self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destino = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((janelas) => {
        for (const janela of janelas) {
          if ("focus" in janela) {
            janela.navigate(destino);
            return janela.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(destino);
        }

        return null;
      })
  );
});
