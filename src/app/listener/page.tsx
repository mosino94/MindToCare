'use client';

export default function ListenerPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 md:p-8 animate-in fade-in-0">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">
          Listener Dashboard
        </h1>
        <p className="text-muted-foreground md:text-xl/relaxed">
          Help members by accepting a request from the request panel.
        </p>
      </div>
    </main>
  );
}
