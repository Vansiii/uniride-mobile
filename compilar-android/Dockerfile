FROM eclipse-temurin:17-jdk
ENV ANDROID_HOME=/opt/android DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip git ca-certificates xz-utils python3 build-essential && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://nodejs.org/dist/v24.11.1/node-v24.11.1-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1
RUN mkdir -p $ANDROID_HOME/cmdline-tools && cd $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o t.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
 && unzip -q t.zip && mv cmdline-tools latest && rm t.zip
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
RUN yes | sdkmanager --licenses >/dev/null && sdkmanager "platform-tools" "build-tools;37.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
