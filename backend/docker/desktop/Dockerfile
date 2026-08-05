FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:1 \
    VNC_PORT=5901 \
    NO_VNC_PORT=6080 \
    SCREEN_GEOMETRY=1920x1080x24 \
    NPM_CONFIG_PREFIX=/home/agentuser/.npm-global \
    PATH=/home/agentuser/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    DOCKER_COMPOSE_VERSION=v2.29.7 \
    HOME=/home/agentuser

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        dbus-x11 \
        dnsutils \
        g++ \
        git \
        gnupg \
        htop \
        iputils-ping \
        jq \
        lsb-release \
        make \
        nano \
        net-tools \
        novnc \
        pkg-config \
        psmisc \
        software-properties-common \
        sudo \
        supervisor \
        tar \
        tmux \
        tree \
        unzip \
        vim \
        websockify \
        wget \
        x11vnc \
        x11-xserver-utils \
        xclip \
        xfce4 \
        xfce4-terminal \
        xsel \
        xvfb \
        zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-dev \
        python3.11-venv \
        python3-pip \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 20 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 20 \
    && curl -fsSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py \
    && python3.11 /tmp/get-pip.py \
    && rm -f /tmp/get-pip.py \
    && python3.11 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && npm --version \
    && node --version \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        containerd \
        docker.io \
    && (apt-get install -y --no-install-recommends docker-compose-plugin \
        || (mkdir -p /usr/local/lib/docker/cli-plugins \
            && curl -fsSL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
                -o /usr/local/lib/docker/cli-plugins/docker-compose \
            && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose)) \
    && docker --version \
    && docker compose version \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash agentuser \
    && usermod -aG docker agentuser \
    && echo "agentuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/agentuser \
    && chmod 0440 /etc/sudoers.d/agentuser \
    && mkdir -p /home/agentuser/workspace \
        /home/agentuser/.config/xfce4/xfconf/xfce-perchannel-xml \
        /home/agentuser/.npm-global \
        /home/agentuser/.vnc \
        /var/log/agenttrust \
    && printf '%s\n' \
        '' \
        '# AgentTrust desktop developer tooling' \
        'export NPM_CONFIG_PREFIX=/home/agentuser/.npm-global' \
        'export PATH=/home/agentuser/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH' \
        >> /home/agentuser/.bashrc \
    && chown -R agentuser:agentuser /home/agentuser /var/log/agenttrust

RUN printf '%s\n' \
        '<?xml version="1.0" encoding="UTF-8"?>' \
        '<channel name="xfce4-power-manager" version="1.0">' \
        '  <property name="xfce4-power-manager" type="empty">' \
        '    <property name="dpms-enabled" type="bool" value="false"/>' \
        '    <property name="blank-on-ac" type="int" value="0"/>' \
        '    <property name="blank-on-battery" type="int" value="0"/>' \
        '    <property name="sleep-display-ac" type="int" value="0"/>' \
        '    <property name="sleep-display-battery" type="int" value="0"/>' \
        '  </property>' \
        '</channel>' \
        > /home/agentuser/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-power-manager.xml \
    && printf '%s\n' \
        '<?xml version="1.0" encoding="UTF-8"?>' \
        '<channel name="xfce4-session" version="1.0">' \
        '  <property name="general" type="empty">' \
        '    <property name="LockCommand" type="string" value=""/>' \
        '    <property name="SaveOnExit" type="bool" value="false"/>' \

RUN printf '%s\n' \
        '<?xml version="1.0" encoding="UTF-8"?>' \
        '<channel name="xfce4-power-manager" version="1.0">' \
        '  <property name="xfce4-power-manager" type="empty">' \
        '    <property name="dpms-enabled" type="bool" value="false"/>' \
        '    <property name="blank-on-ac" type="int" value="0"/>' \
        '    <property name="blank-on-battery" type="int" value="0"/>' \
        '    <property name="sleep-display-ac" type="int" value="0"/>' \
        '    <property name="sleep-display-battery" type="int" value="0"/>' \
        '  </property>' \
        '</channel>' \
        > /home/agentuser/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-power-manager.xml \
    && printf '%s\n' \
        '<?xml version="1.0" encoding="UTF-8"?>' \
        '<channel name="xfce4-session" version="1.0">' \
        '  <property name="general" type="empty">' \
        '    <property name="LockCommand" type="string" value=""/>' \
        '    <property name="SaveOnExit" type="bool" value="false"/>' \
        '  </property>' \
        '</channel>' \
        > /home/agentuser/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-session.xml

RUN chown -R agentuser:agentuser /home/agentuser/.config

COPY entrypoint.sh /usr/local/bin/agenttrust-desktop-entrypoint.sh
RUN chmod +x /usr/local/bin/agenttrust-desktop-entrypoint.sh

RUN mkdir -p /agenttrust
COPY bootstrap.sh /agenttrust/bootstrap.sh
RUN chmod +x /agenttrust/bootstrap.sh

WORKDIR /home/agentuser/workspace

EXPOSE 5901 6080

ENTRYPOINT ["/usr/local/bin/agenttrust-desktop-entrypoint.sh"]
