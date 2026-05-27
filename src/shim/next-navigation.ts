export const useRouter = () => ({
  push: (path: string) => {
    window.location.href = path;
  },

  replace: (path: string) => {
    window.location.replace(path);
  },

  back: () => {
    window.history.back();
  },
});

export const redirect = (path: string) => {
  window.location.href = path;
};

export const usePathname = () => {
  return window.location.pathname;
};